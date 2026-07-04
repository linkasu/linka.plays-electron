#include <node_api.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cctype>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace {

constexpr int kColumns = 7;
constexpr int kRows = 6;
constexpr int kCells = kColumns * kRows;
constexpr int kWinScore = 1000000;
constexpr std::array<int, kColumns> kMoveOrder = {3, 2, 4, 1, 5, 0, 6};

using Board = std::array<char, kCells>;
using Clock = std::chrono::steady_clock;

struct SearchResult {
  int column = -1;
  int score = 0;
  int depth = 0;
  std::uint64_t nodes = 0;
  double elapsedMs = 0;
  bool timedOut = false;
};

struct TableEntry {
  int depth;
  int score;
};

struct SearchContext {
  Clock::time_point deadline;
  std::atomic_bool stopped{false};
};

struct RootScore {
  int column;
  int score;
  std::uint64_t nodes;
};

struct Position {
  std::uint64_t position = 0;
  std::uint64_t mask = 0;
  int moves = 0;

  bool CanPlay(int column) const;
  void Play(int column);
};

struct SearchRequest {
  std::string boardText;
  char player = 'Y';
  int depth = 16;
  int timeLimitMs = 1800;
  int threads = 0;
  SearchResult result;
  napi_deferred deferred = nullptr;
  napi_async_work work = nullptr;
};

struct ReversiRequest {
  std::string boardText;
  char player = 'Y';
  int depth = 12;
  int timeLimitMs = 800;
  SearchResult result;
  napi_deferred deferred = nullptr;
  napi_async_work work = nullptr;
};

struct CheckersRequest {
  std::string boardText;
  char side = 'b';
  int depth = 6;
  int timeLimitMs = 1200;
  int forcedFrom = -1;
  int fromIndex = -1;
  int toIndex = -1;
  int capturedIndex = -1;
  int score = 0;
  int reachedDepth = 0;
  std::uint64_t nodes = 0;
  double elapsedMs = 0;
  bool timedOut = false;
  napi_deferred deferred = nullptr;
  napi_async_work work = nullptr;
};

enum class ChessJobKind { LegalMoves, ApplyMove, BestMove };

struct ChessRequest {
  ChessJobKind kind = ChessJobKind::LegalMoves;
  std::string fen;
  int fromIndex = -1;
  int toIndex = -1;
  char promotion = 'q';
  int depth = 4;
  int timeLimitMs = 1500;
  std::string resultFen;
  std::vector<int> moveFrom;
  std::vector<int> moveTo;
  std::vector<char> movePromotion;
  std::vector<int> moveFlags;
  int bestFrom = -1;
  int bestTo = -1;
  char bestPromotion = 0;
  int score = 0;
  int reachedDepth = 0;
  std::uint64_t nodes = 0;
  double elapsedMs = 0;
  bool ok = false;
  bool check = false;
  bool timedOut = false;
  std::string status = "playing";
  std::string reason;
  napi_deferred deferred = nullptr;
  napi_async_work work = nullptr;
};

int CellIndex(int row, int column) {
  return row * kColumns + column;
}

std::uint64_t BottomMask(int column) {
  return 1ull << (column * 7);
}

std::uint64_t TopMask(int column) {
  return 1ull << (column * 7 + kRows - 1);
}

std::uint64_t BoardBit(int row, int column) {
  return 1ull << (column * 7 + (kRows - 1 - row));
}

bool Position::CanPlay(int column) const {
  return column >= 0 && column < kColumns && (mask & TopMask(column)) == 0;
}

void Position::Play(int column) {
  position ^= mask;
  mask |= mask + BottomMask(column);
  moves += 1;
}

char Opponent(char player) {
  return player == 'R' ? 'Y' : 'R';
}

bool IsInside(int row, int column) {
  return row >= 0 && row < kRows && column >= 0 && column < kColumns;
}

[[maybe_unused]] Board ParseBoard(const std::string& text) {
  Board board{};
  board.fill('.');
  for (int index = 0; index < kCells && index < static_cast<int>(text.size()); index += 1) {
    const char cell = text[index];
    board[index] = cell == 'R' || cell == 'Y' ? cell : '.';
  }
  return board;
}

Position ParsePosition(const std::string& text, char player) {
  std::uint64_t red = 0;
  std::uint64_t yellow = 0;
  int moves = 0;
  for (int row = 0; row < kRows; row += 1) {
    for (int column = 0; column < kColumns; column += 1) {
      const int index = CellIndex(row, column);
      const char cell = index < static_cast<int>(text.size()) ? text[index] : '.';
      if (cell == 'R') {
        red |= BoardBit(row, column);
        moves += 1;
      } else if (cell == 'Y') {
        yellow |= BoardBit(row, column);
        moves += 1;
      }
    }
  }

  return Position{player == 'R' ? red : yellow, red | yellow, moves};
}

bool HasWon(std::uint64_t position) {
  std::uint64_t match = position & (position >> 1);
  if ((match & (match >> 2)) != 0) return true;
  match = position & (position >> 7);
  if ((match & (match >> 14)) != 0) return true;
  match = position & (position >> 6);
  if ((match & (match >> 12)) != 0) return true;
  match = position & (position >> 8);
  return (match & (match >> 16)) != 0;
}

std::vector<int> LegalMoves(const Position& position) {
  std::vector<int> moves;
  moves.reserve(kColumns);
  for (const int column : kMoveOrder) {
    if (position.CanPlay(column)) moves.push_back(column);
  }
  return moves;
}

std::vector<int> LegalMoves(const Board& board) {
  std::vector<int> moves;
  moves.reserve(kColumns);
  for (const int column : kMoveOrder) {
    if (board[CellIndex(0, column)] == '.') moves.push_back(column);
  }
  return moves;
}

bool DropDisc(Board& board, int column, char player) {
  if (column < 0 || column >= kColumns) return false;
  for (int row = kRows - 1; row >= 0; row -= 1) {
    const int index = CellIndex(row, column);
    if (board[index] == '.') {
      board[index] = player;
      return true;
    }
  }
  return false;
}

char Winner(const Board& board) {
  constexpr int directions[4][2] = {{1, 0}, {0, 1}, {1, 1}, {1, -1}};
  for (int row = 0; row < kRows; row += 1) {
    for (int column = 0; column < kColumns; column += 1) {
      const char mark = board[CellIndex(row, column)];
      if (mark == '.') continue;
      for (const auto& direction : directions) {
        bool line = true;
        for (int offset = 1; offset < 4; offset += 1) {
          const int nextRow = row + direction[1] * offset;
          const int nextColumn = column + direction[0] * offset;
          if (!IsInside(nextRow, nextColumn) || board[CellIndex(nextRow, nextColumn)] != mark) {
            line = false;
            break;
          }
        }
        if (line) return mark;
      }
    }
  }
  return '.';
}

bool IsDraw(const Board& board) {
  for (int column = 0; column < kColumns; column += 1) {
    if (board[CellIndex(0, column)] == '.') return false;
  }
  return true;
}

int ScoreWindow(int own, int opponent, int empty) {
  if (own == 4) return 100000;
  if (opponent == 4) return -100000;
  if (own == 3 && empty == 1) return 900;
  if (opponent == 3 && empty == 1) return -1050;
  if (own == 2 && empty == 2) return 80;
  if (opponent == 2 && empty == 2) return -90;
  return 0;
}

int Evaluate(const Board& board, char player) {
  const char opponent = Opponent(player);
  int score = 0;

  for (int row = 0; row < kRows; row += 1) {
    if (board[CellIndex(row, 3)] == player) score += 18;
    if (board[CellIndex(row, 3)] == opponent) score -= 18;
  }

  constexpr int directions[4][2] = {{1, 0}, {0, 1}, {1, 1}, {1, -1}};
  for (int row = 0; row < kRows; row += 1) {
    for (int column = 0; column < kColumns; column += 1) {
      for (const auto& direction : directions) {
        int own = 0;
        int other = 0;
        int empty = 0;
        bool valid = true;
        for (int offset = 0; offset < 4; offset += 1) {
          const int nextRow = row + direction[1] * offset;
          const int nextColumn = column + direction[0] * offset;
          if (!IsInside(nextRow, nextColumn)) {
            valid = false;
            break;
          }
          const char cell = board[CellIndex(nextRow, nextColumn)];
          if (cell == player) own += 1;
          else if (cell == opponent) other += 1;
          else empty += 1;
        }
        if (valid) score += ScoreWindow(own, other, empty);
      }
    }
  }

  return score;
}

int Evaluate(const Position& position) {
  const std::uint64_t own = position.position;
  const std::uint64_t other = position.position ^ position.mask;
  int score = 0;

  for (int row = 0; row < kRows; row += 1) {
    const std::uint64_t bit = BoardBit(row, 3);
    if ((own & bit) != 0) score += 18;
    if ((other & bit) != 0) score -= 18;
  }

  constexpr int directions[4][2] = {{1, 0}, {0, 1}, {1, 1}, {1, -1}};
  for (int row = 0; row < kRows; row += 1) {
    for (int column = 0; column < kColumns; column += 1) {
      for (const auto& direction : directions) {
        int ownCount = 0;
        int otherCount = 0;
        int empty = 0;
        bool valid = true;
        for (int offset = 0; offset < 4; offset += 1) {
          const int nextRow = row + direction[1] * offset;
          const int nextColumn = column + direction[0] * offset;
          if (!IsInside(nextRow, nextColumn)) {
            valid = false;
            break;
          }
          const std::uint64_t bit = BoardBit(nextRow, nextColumn);
          if ((own & bit) != 0) ownCount += 1;
          else if ((other & bit) != 0) otherCount += 1;
          else empty += 1;
        }
        if (valid) score += ScoreWindow(ownCount, otherCount, empty);
      }
    }
  }

  return score;
}

std::uint64_t HashBoard(const Board& board, char player) {
  std::uint64_t hash = player == 'R' ? 1469598103934665603ull : 1099511628211ull;
  for (const char cell : board) {
    const std::uint64_t value = cell == 'R' ? 1 : cell == 'Y' ? 2 : 0;
    hash ^= value + 0x9e3779b97f4a7c15ull + (hash << 6) + (hash >> 2);
  }
  return hash;
}

std::uint64_t HashPosition(const Position& position) {
  return position.position ^ (position.mask + 0x9e3779b97f4a7c15ull + (position.position << 6) + (position.position >> 2));
}

bool Expired(SearchContext& context) {
  if (context.stopped.load(std::memory_order_relaxed)) return true;
  if (Clock::now() >= context.deadline) {
    context.stopped.store(true, std::memory_order_relaxed);
    return true;
  }
  return false;
}

int Negamax(Board& board, char player, int depth, int alpha, int beta, SearchContext& context, std::unordered_map<std::uint64_t, TableEntry>& table, std::uint64_t& nodes) {
  nodes += 1;
  if ((nodes & 2047u) == 0 && Expired(context)) return Evaluate(board, player);

  const char winner = Winner(board);
  if (winner != '.') return winner == player ? kWinScore + depth : -kWinScore - depth;
  if (IsDraw(board)) return 0;
  if (depth <= 0) return Evaluate(board, player);

  const std::uint64_t key = HashBoard(board, player);
  const auto found = table.find(key);
  if (found != table.end() && found->second.depth >= depth) return found->second.score;

  int best = -kWinScore * 2;
  for (const int column : LegalMoves(board)) {
    Board next = board;
    if (!DropDisc(next, column, player)) continue;
    const int score = -Negamax(next, Opponent(player), depth - 1, -beta, -alpha, context, table, nodes);
    if (Expired(context)) return best == -kWinScore * 2 ? score : best;
    best = std::max(best, score);
    alpha = std::max(alpha, score);
    if (alpha >= beta) break;
  }

  table[key] = TableEntry{depth, best};
  return best;
}

int Negamax(Position& position, int depth, int alpha, int beta, SearchContext& context, std::unordered_map<std::uint64_t, TableEntry>& table, std::uint64_t& nodes) {
  nodes += 1;
  if ((nodes & 8191u) == 0 && Expired(context)) return Evaluate(position);

  if (HasWon(position.position ^ position.mask)) return -kWinScore - depth;
  if (position.moves >= kCells) return 0;
  if (depth <= 0) return Evaluate(position);

  const std::uint64_t key = HashPosition(position);
  const auto found = table.find(key);
  if (found != table.end() && found->second.depth >= depth) return found->second.score;

  int best = -kWinScore * 2;
  for (const int column : LegalMoves(position)) {
    Position next = position;
    next.Play(column);
    const int score = -Negamax(next, depth - 1, -beta, -alpha, context, table, nodes);
    if (Expired(context)) return best == -kWinScore * 2 ? score : best;
    best = std::max(best, score);
    alpha = std::max(alpha, score);
    if (alpha >= beta) break;
  }

  table[key] = TableEntry{depth, best};
  return best;
}

[[maybe_unused]] std::vector<RootScore> SearchRootDepth(const Board& board, char player, int depth, int requestedThreads, SearchContext& context) {
  const std::vector<int> moves = LegalMoves(board);
  if (moves.empty()) return {};

  const unsigned int hardware = std::max(1u, std::thread::hardware_concurrency());
  const int maxThreads = requestedThreads > 0 ? requestedThreads : static_cast<int>(std::max(1u, hardware > 1 ? hardware - 1 : 1));
  const int threadCount = std::max(1, std::min({maxThreads, static_cast<int>(moves.size()), kColumns}));
  std::atomic<int> nextIndex{0};
  std::mutex resultsMutex;
  std::vector<RootScore> results;
  results.reserve(moves.size());

  auto worker = [&]() {
    std::unordered_map<std::uint64_t, TableEntry> table;
    while (!Expired(context)) {
      const int index = nextIndex.fetch_add(1);
      if (index >= static_cast<int>(moves.size())) break;

      Board next = board;
      const int column = moves[index];
      if (!DropDisc(next, column, player)) continue;
      std::uint64_t nodes = 0;
      const int score = -Negamax(next, Opponent(player), depth - 1, -kWinScore * 2, kWinScore * 2, context, table, nodes);
      if (Expired(context)) break;

      std::lock_guard<std::mutex> lock(resultsMutex);
      results.push_back(RootScore{column, score, nodes});
    }
  };

  std::vector<std::thread> workers;
  workers.reserve(threadCount);
  for (int index = 0; index < threadCount; index += 1) workers.emplace_back(worker);
  for (auto& thread : workers) thread.join();

  return results;
}

std::vector<RootScore> SearchRootDepth(const Position& position, int depth, int requestedThreads, SearchContext& context) {
  const std::vector<int> moves = LegalMoves(position);
  if (moves.empty()) return {};

  const unsigned int hardware = std::max(1u, std::thread::hardware_concurrency());
  const int maxThreads = requestedThreads > 0 ? requestedThreads : static_cast<int>(std::max(1u, hardware > 1 ? hardware - 1 : 1));
  const int threadCount = std::max(1, std::min({maxThreads, static_cast<int>(moves.size()), kColumns}));
  std::atomic<int> nextIndex{1};
  std::atomic<int> sharedAlpha{-kWinScore * 2};
  std::mutex resultsMutex;
  std::vector<RootScore> results;
  results.reserve(moves.size());

  {
    std::unordered_map<std::uint64_t, TableEntry> table;
    Position next = position;
    next.Play(moves.front());
    std::uint64_t nodes = 0;
    const int score = -Negamax(next, depth - 1, -kWinScore * 2, kWinScore * 2, context, table, nodes);
    if (!Expired(context)) {
      sharedAlpha.store(score, std::memory_order_relaxed);
      results.push_back(RootScore{moves.front(), score, nodes});
    }
  }

  auto worker = [&]() {
    std::unordered_map<std::uint64_t, TableEntry> table;
    while (!Expired(context)) {
      const int index = nextIndex.fetch_add(1);
      if (index >= static_cast<int>(moves.size())) break;

      const int column = moves[index];
      Position next = position;
      next.Play(column);
      std::uint64_t nodes = 0;
      const int alpha = sharedAlpha.load(std::memory_order_relaxed);
      const int score = -Negamax(next, depth - 1, -kWinScore * 2, -alpha, context, table, nodes);
      if (Expired(context)) break;

      int currentAlpha = sharedAlpha.load(std::memory_order_relaxed);
      while (score > currentAlpha && !sharedAlpha.compare_exchange_weak(currentAlpha, score, std::memory_order_relaxed)) {}

      std::lock_guard<std::mutex> lock(resultsMutex);
      results.push_back(RootScore{column, score, nodes});
    }
  };

  std::vector<std::thread> workers;
  workers.reserve(threadCount);
  for (int index = 0; index < threadCount; index += 1) workers.emplace_back(worker);
  for (auto& thread : workers) thread.join();

  return results;
}

SearchResult FindBestMove(const std::string& boardText, char player, int maxDepth, int timeLimitMs, int requestedThreads) {
  const auto startedAt = Clock::now();
  SearchContext context{startedAt + std::chrono::milliseconds(std::max(50, timeLimitMs))};
  const Position position = ParsePosition(boardText, player);
  const std::vector<int> legalMoves = LegalMoves(position);

  SearchResult best;
  if (legalMoves.empty()) return best;
  best.column = legalMoves.front();
  best.score = Evaluate(position);

  for (int depth = 1; depth <= std::max(1, maxDepth); depth += 1) {
    const auto scores = SearchRootDepth(position, depth, requestedThreads, context);
    if (scores.empty() || context.stopped.load(std::memory_order_relaxed)) break;

    RootScore depthBest = scores.front();
    std::uint64_t depthNodes = 0;
    for (const auto& score : scores) {
      depthNodes += score.nodes;
      if (score.score > depthBest.score || (score.score == depthBest.score && std::abs(3 - score.column) < std::abs(3 - depthBest.column))) depthBest = score;
    }

    best.column = depthBest.column;
    best.score = depthBest.score;
    best.depth = depth;
    best.nodes += depthNodes;
  }

  best.timedOut = context.stopped.load(std::memory_order_relaxed);
  best.elapsedMs = std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count();
  return best;
}

constexpr int kReversiSize = 4;
constexpr int kReversiCells = kReversiSize * kReversiSize;
using ReversiBoard = std::array<char, kReversiCells>;

int ReversiIndex(int row, int column) {
  return row * kReversiSize + column;
}

bool ReversiInside(int row, int column) {
  return row >= 0 && row < kReversiSize && column >= 0 && column < kReversiSize;
}

ReversiBoard ParseReversiBoard(const std::string& text) {
  ReversiBoard board{};
  board.fill('.');
  for (int index = 0; index < kReversiCells && index < static_cast<int>(text.size()); index += 1) {
    const char cell = text[index];
    board[index] = cell == 'R' || cell == 'Y' ? cell : '.';
  }
  return board;
}

std::vector<int> ReversiFlips(const ReversiBoard& board, int index, char player) {
  if (index < 0 || index >= kReversiCells || board[index] != '.') return {};
  constexpr int directions[8][2] = {{-1, -1}, {-1, 0}, {-1, 1}, {0, -1}, {0, 1}, {1, -1}, {1, 0}, {1, 1}};
  const char other = Opponent(player);
  const int row = index / kReversiSize;
  const int column = index % kReversiSize;
  std::vector<int> flips;

  for (const auto& direction : directions) {
    std::vector<int> line;
    int nextRow = row + direction[0];
    int nextColumn = column + direction[1];
    while (ReversiInside(nextRow, nextColumn) && board[ReversiIndex(nextRow, nextColumn)] == other) {
      line.push_back(ReversiIndex(nextRow, nextColumn));
      nextRow += direction[0];
      nextColumn += direction[1];
    }

    if (!line.empty() && ReversiInside(nextRow, nextColumn) && board[ReversiIndex(nextRow, nextColumn)] == player) flips.insert(flips.end(), line.begin(), line.end());
  }

  return flips;
}

std::vector<int> ReversiMoves(const ReversiBoard& board, char player) {
  std::vector<int> moves;
  moves.reserve(kReversiCells);
  constexpr std::array<int, kReversiCells> order = {0, 3, 12, 15, 1, 2, 4, 7, 8, 11, 13, 14, 5, 6, 9, 10};
  for (const int index : order) {
    if (!ReversiFlips(board, index, player).empty()) moves.push_back(index);
  }
  return moves;
}

ReversiBoard ReversiApply(const ReversiBoard& board, int move, char player) {
  ReversiBoard next = board;
  const std::vector<int> flips = ReversiFlips(board, move, player);
  if (flips.empty()) return next;
  next[move] = player;
  for (const int index : flips) next[index] = player;
  return next;
}

int ReversiEvaluate(const ReversiBoard& board, char player) {
  const char other = Opponent(player);
  int score = 0;
  constexpr std::array<int, kReversiCells> weights = {8, 2, 2, 8, 2, 1, 1, 2, 2, 1, 1, 2, 8, 2, 2, 8};
  for (int index = 0; index < kReversiCells; index += 1) {
    if (board[index] == player) score += 10 + weights[index];
    else if (board[index] == other) score -= 10 + weights[index];
  }
  score += static_cast<int>(ReversiMoves(board, player).size()) * 5;
  score -= static_cast<int>(ReversiMoves(board, other).size()) * 6;
  return score;
}

bool ReversiFull(const ReversiBoard& board) {
  return std::all_of(board.begin(), board.end(), [](char cell) { return cell != '.'; });
}

int ReversiNegamax(const ReversiBoard& board, char player, int depth, int alpha, int beta, SearchContext& context, std::uint64_t& nodes) {
  nodes += 1;
  if ((nodes & 1023u) == 0 && Expired(context)) return ReversiEvaluate(board, player);
  const std::vector<int> moves = ReversiMoves(board, player);
  const std::vector<int> otherMoves = ReversiMoves(board, Opponent(player));
  if (depth <= 0 || ReversiFull(board) || (moves.empty() && otherMoves.empty())) return ReversiEvaluate(board, player);
  if (moves.empty()) return -ReversiNegamax(board, Opponent(player), depth - 1, -beta, -alpha, context, nodes);

  int best = -kWinScore;
  for (const int move : moves) {
    const ReversiBoard next = ReversiApply(board, move, player);
    const int score = -ReversiNegamax(next, Opponent(player), depth - 1, -beta, -alpha, context, nodes);
    if (Expired(context)) return best == -kWinScore ? score : best;
    best = std::max(best, score);
    alpha = std::max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

SearchResult FindBestReversiMove(const std::string& boardText, char player, int maxDepth, int timeLimitMs) {
  const auto startedAt = Clock::now();
  SearchContext context{startedAt + std::chrono::milliseconds(std::max(50, timeLimitMs))};
  const ReversiBoard board = ParseReversiBoard(boardText);
  const std::vector<int> moves = ReversiMoves(board, player);
  SearchResult best;
  if (moves.empty()) return best;
  best.column = moves.front();
  best.score = -kWinScore;

  for (int depth = 1; depth <= std::max(1, maxDepth); depth += 1) {
    int depthMove = best.column;
    int depthScore = -kWinScore;
    std::uint64_t depthNodes = 0;
    for (const int move : moves) {
      const ReversiBoard next = ReversiApply(board, move, player);
      std::uint64_t nodes = 0;
      const int score = -ReversiNegamax(next, Opponent(player), depth - 1, -kWinScore, kWinScore, context, nodes);
      depthNodes += nodes;
      if (Expired(context)) break;
      if (score > depthScore) {
        depthScore = score;
        depthMove = move;
      }
    }
    if (context.stopped.load(std::memory_order_relaxed)) break;
    best.column = depthMove;
    best.score = depthScore;
    best.depth = depth;
    best.nodes += depthNodes;
  }

  best.timedOut = context.stopped.load(std::memory_order_relaxed);
  best.elapsedMs = std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count();
  return best;
}

constexpr int kCheckersSize = 8;
constexpr int kCheckersCells = 64;
using CheckersBoard = std::array<char, kCheckersCells>;

struct CheckersMove {
  int from = -1;
  int to = -1;
  int captured = -1;
};

int CheckersIndex(int row, int column) {
  return row * kCheckersSize + column;
}

bool CheckersInside(int row, int column) {
  return row >= 0 && row < kCheckersSize && column >= 0 && column < kCheckersSize;
}

int CheckersRow(int index) {
  return index / kCheckersSize;
}

int CheckersColumn(int index) {
  return index % kCheckersSize;
}

bool CheckersIsBlue(char piece) {
  return piece == 'b' || piece == 'B';
}

bool CheckersIsGold(char piece) {
  return piece == 'g' || piece == 'G';
}

bool CheckersIsKing(char piece) {
  return piece == 'B' || piece == 'G';
}

bool CheckersOwn(char piece, char side) {
  return side == 'b' ? CheckersIsBlue(piece) : CheckersIsGold(piece);
}

bool CheckersEnemy(char piece, char side) {
  return side == 'b' ? CheckersIsGold(piece) : CheckersIsBlue(piece);
}

char CheckersOpponent(char side) {
  return side == 'b' ? 'g' : 'b';
}

CheckersBoard ParseCheckersBoard(const std::string& text) {
  CheckersBoard board{};
  board.fill('.');
  for (int index = 0; index < kCheckersCells && index < static_cast<int>(text.size()); index += 1) {
    const char cell = text[index];
    board[index] = cell == 'g' || cell == 'G' || cell == 'b' || cell == 'B' ? cell : '.';
  }
  return board;
}

std::vector<CheckersMove> CheckersCaptureMovesFor(const CheckersBoard& board, int from, char side) {
  const char piece = board[from];
  if (!CheckersOwn(piece, side)) return {};
  constexpr int dirs[4][2] = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}};
  std::vector<CheckersMove> moves;
  const int row = CheckersRow(from);
  const int column = CheckersColumn(from);

  if (CheckersIsKing(piece)) {
    for (const auto& dir : dirs) {
      int captured = -1;
      int nextRow = row + dir[0];
      int nextColumn = column + dir[1];
      while (CheckersInside(nextRow, nextColumn)) {
        const int index = CheckersIndex(nextRow, nextColumn);
        const char nextPiece = board[index];
        if (nextPiece == '.') {
          if (captured >= 0) moves.push_back(CheckersMove{from, index, captured});
        } else if (CheckersOwn(nextPiece, side) || captured >= 0) {
          break;
        } else {
          captured = index;
        }
        nextRow += dir[0];
        nextColumn += dir[1];
      }
    }
    return moves;
  }

  for (const auto& dir : dirs) {
    const int capturedRow = row + dir[0];
    const int capturedColumn = column + dir[1];
    const int landRow = row + dir[0] * 2;
    const int landColumn = column + dir[1] * 2;
    if (!CheckersInside(capturedRow, capturedColumn) || !CheckersInside(landRow, landColumn)) continue;
    const int captured = CheckersIndex(capturedRow, capturedColumn);
    const int land = CheckersIndex(landRow, landColumn);
    if (CheckersEnemy(board[captured], side) && board[land] == '.') moves.push_back(CheckersMove{from, land, captured});
  }
  return moves;
}

std::vector<CheckersMove> CheckersQuietMovesFor(const CheckersBoard& board, int from, char side) {
  const char piece = board[from];
  if (!CheckersOwn(piece, side)) return {};
  constexpr int dirs[4][2] = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}};
  std::vector<CheckersMove> moves;
  const int row = CheckersRow(from);
  const int column = CheckersColumn(from);

  if (CheckersIsKing(piece)) {
    for (const auto& dir : dirs) {
      int nextRow = row + dir[0];
      int nextColumn = column + dir[1];
      while (CheckersInside(nextRow, nextColumn)) {
        const int index = CheckersIndex(nextRow, nextColumn);
        if (board[index] != '.') break;
        moves.push_back(CheckersMove{from, index, -1});
        nextRow += dir[0];
        nextColumn += dir[1];
      }
    }
    return moves;
  }

  const int forward = side == 'b' ? 1 : -1;
  for (const int columnStep : {-1, 1}) {
    const int nextRow = row + forward;
    const int nextColumn = column + columnStep;
    if (!CheckersInside(nextRow, nextColumn)) continue;
    const int index = CheckersIndex(nextRow, nextColumn);
    if (board[index] == '.') moves.push_back(CheckersMove{from, index, -1});
  }
  return moves;
}

std::vector<CheckersMove> CheckersMoves(const CheckersBoard& board, char side, int forcedFrom = -1) {
  std::vector<int> indexes;
  if (forcedFrom >= 0) indexes.push_back(forcedFrom);
  else {
    for (int index = 0; index < kCheckersCells; index += 1) {
      if (CheckersOwn(board[index], side)) indexes.push_back(index);
    }
  }

  std::vector<CheckersMove> captures;
  for (const int index : indexes) {
    const auto moves = CheckersCaptureMovesFor(board, index, side);
    captures.insert(captures.end(), moves.begin(), moves.end());
  }
  if (!captures.empty()) return captures;
  if (forcedFrom >= 0) return {};

  std::vector<CheckersMove> moves;
  for (const int index : indexes) {
    const auto quiet = CheckersQuietMovesFor(board, index, side);
    moves.insert(moves.end(), quiet.begin(), quiet.end());
  }
  return moves;
}

CheckersBoard CheckersApply(const CheckersBoard& board, const CheckersMove& move, char side) {
  CheckersBoard next = board;
  char piece = next[move.from];
  next[move.from] = '.';
  if (move.captured >= 0) next[move.captured] = '.';
  const int row = CheckersRow(move.to);
  if (piece == 'b' && row == kCheckersSize - 1) piece = 'B';
  if (piece == 'g' && row == 0) piece = 'G';
  next[move.to] = piece;
  return next;
}

int CheckersEvaluate(const CheckersBoard& board) {
  int score = 0;
  for (int index = 0; index < kCheckersCells; index += 1) {
    const char piece = board[index];
    if (piece == '.') continue;
    const int row = CheckersRow(index);
    const int advancement = CheckersIsBlue(piece) ? row : kCheckersSize - 1 - row;
    const int value = (CheckersIsKing(piece) ? 260 : 100) + advancement * 6;
    score += CheckersIsBlue(piece) ? value : -value;
  }
  score += static_cast<int>(CheckersMoves(board, 'b').size()) * 3;
  score -= static_cast<int>(CheckersMoves(board, 'g').size()) * 3;
  return score;
}

int CheckersNegamax(CheckersBoard board, char side, int forcedFrom, int depth, int alpha, int beta, SearchContext& context, std::uint64_t& nodes) {
  nodes += 1;
  if ((nodes & 2047u) == 0 && Expired(context)) return side == 'b' ? CheckersEvaluate(board) : -CheckersEvaluate(board);
  const auto moves = CheckersMoves(board, side, forcedFrom);
  if (depth <= 0 || moves.empty()) return side == 'b' ? CheckersEvaluate(board) : -CheckersEvaluate(board);

  int best = -kWinScore;
  for (const auto& move : moves) {
    const CheckersBoard next = CheckersApply(board, move, side);
    const int nextForced = move.captured >= 0 && !CheckersCaptureMovesFor(next, move.to, side).empty() ? move.to : -1;
    const int score = nextForced >= 0
      ? CheckersNegamax(next, side, nextForced, depth - 1, alpha, beta, context, nodes)
      : -CheckersNegamax(next, CheckersOpponent(side), -1, depth - 1, -beta, -alpha, context, nodes);
    if (Expired(context)) return best == -kWinScore ? score : best;
    best = std::max(best, score);
    alpha = std::max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

void FindBestCheckersMove(CheckersRequest* request) {
  const auto startedAt = Clock::now();
  SearchContext context{startedAt + std::chrono::milliseconds(std::max(50, request->timeLimitMs))};
  const CheckersBoard board = ParseCheckersBoard(request->boardText);
  const auto rootMoves = CheckersMoves(board, request->side, request->forcedFrom);
  if (rootMoves.empty()) return;

  CheckersMove best = rootMoves.front();
  int bestScore = -kWinScore;
  for (int depth = 1; depth <= std::max(1, request->depth); depth += 1) {
    CheckersMove depthBest = best;
    int depthScore = -kWinScore;
    std::uint64_t depthNodes = 0;
    for (const auto& move : rootMoves) {
      const CheckersBoard next = CheckersApply(board, move, request->side);
      const int nextForced = move.captured >= 0 && !CheckersCaptureMovesFor(next, move.to, request->side).empty() ? move.to : -1;
      std::uint64_t nodes = 0;
      const int score = nextForced >= 0
        ? CheckersNegamax(next, request->side, nextForced, depth - 1, -kWinScore, kWinScore, context, nodes)
        : -CheckersNegamax(next, CheckersOpponent(request->side), -1, depth - 1, -kWinScore, kWinScore, context, nodes);
      depthNodes += nodes;
      if (Expired(context)) break;
      if (score > depthScore) {
        depthScore = score;
        depthBest = move;
      }
    }
    if (context.stopped.load(std::memory_order_relaxed)) break;
    best = depthBest;
    bestScore = depthScore;
    request->reachedDepth = depth;
    request->nodes += depthNodes;
  }

  request->fromIndex = best.from;
  request->toIndex = best.to;
  request->capturedIndex = best.captured;
  request->score = bestScore;
  request->timedOut = context.stopped.load(std::memory_order_relaxed);
  request->elapsedMs = std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count();
}

struct ChessMove {
  int from = -1;
  int to = -1;
  char promotion = 0;
  int flags = 0;
};

struct ChessPosition {
  std::array<char, 64> board{};
  char side = 'w';
  bool whiteKingCastle = true;
  bool whiteQueenCastle = true;
  bool blackKingCastle = true;
  bool blackQueenCastle = true;
  int enPassant = -1;
  int halfmove = 0;
  int fullmove = 1;
};

constexpr int kChessCapture = 1;
constexpr int kChessCastle = 2;
constexpr int kChessEnPassant = 4;
constexpr int kChessPromotion = 8;

int ChessIndex(int row, int column) { return row * 8 + column; }
int ChessRow(int index) { return index / 8; }
int ChessColumn(int index) { return index % 8; }
bool ChessInside(int row, int column) { return row >= 0 && row < 8 && column >= 0 && column < 8; }
bool ChessWhite(char piece) { return piece >= 'A' && piece <= 'Z'; }
bool ChessBlack(char piece) { return piece >= 'a' && piece <= 'z'; }
bool ChessOwn(char piece, char side) { return piece != '.' && (side == 'w' ? ChessWhite(piece) : ChessBlack(piece)); }
bool ChessEnemy(char piece, char side) { return piece != '.' && (side == 'w' ? ChessBlack(piece) : ChessWhite(piece)); }
char ChessOpponent(char side) { return side == 'w' ? 'b' : 'w'; }

std::string ChessSquareName(int index) {
  if (index < 0 || index >= 64) return "-";
  std::string result;
  result.push_back(static_cast<char>('a' + ChessColumn(index)));
  result.push_back(static_cast<char>('8' - ChessRow(index)));
  return result;
}

int ChessSquareIndex(const std::string& square) {
  if (square.size() != 2 || square == "-") return -1;
  const int column = square[0] - 'a';
  const int row = '8' - square[1];
  return ChessInside(row, column) ? ChessIndex(row, column) : -1;
}

ChessPosition ParseChessFen(const std::string& fen) {
  ChessPosition position;
  position.board.fill('.');
  std::istringstream input(fen);
  std::string placement;
  std::string side;
  std::string castling;
  std::string enPassant;
  input >> placement >> side >> castling >> enPassant >> position.halfmove >> position.fullmove;
  int index = 0;
  for (const char token : placement) {
    if (token == '/') continue;
    if (std::isdigit(static_cast<unsigned char>(token))) {
      index += token - '0';
      continue;
    }
    if (index >= 0 && index < 64) position.board[index] = token;
    index += 1;
  }
  position.side = side == "b" ? 'b' : 'w';
  position.whiteKingCastle = castling.find('K') != std::string::npos;
  position.whiteQueenCastle = castling.find('Q') != std::string::npos;
  position.blackKingCastle = castling.find('k') != std::string::npos;
  position.blackQueenCastle = castling.find('q') != std::string::npos;
  position.enPassant = ChessSquareIndex(enPassant);
  return position;
}

std::string ChessFen(const ChessPosition& position) {
  std::string placement;
  for (int row = 0; row < 8; row += 1) {
    int empty = 0;
    for (int column = 0; column < 8; column += 1) {
      const char piece = position.board[ChessIndex(row, column)];
      if (piece == '.') {
        empty += 1;
        continue;
      }
      if (empty) {
        placement += std::to_string(empty);
        empty = 0;
      }
      placement.push_back(piece);
    }
    if (empty) placement += std::to_string(empty);
    if (row != 7) placement.push_back('/');
  }
  std::string castling;
  if (position.whiteKingCastle) castling.push_back('K');
  if (position.whiteQueenCastle) castling.push_back('Q');
  if (position.blackKingCastle) castling.push_back('k');
  if (position.blackQueenCastle) castling.push_back('q');
  if (castling.empty()) castling = "-";
  return placement + " " + std::string(1, position.side) + " " + castling + " " + ChessSquareName(position.enPassant) + " " + std::to_string(position.halfmove) + " " + std::to_string(position.fullmove);
}

bool ChessAttacked(const ChessPosition& position, int square, char bySide) {
  const int row = ChessRow(square);
  const int column = ChessColumn(square);
  const int pawnRow = row + (bySide == 'w' ? 1 : -1);
  for (const int dc : {-1, 1}) {
    const int pawnColumn = column + dc;
    if (ChessInside(pawnRow, pawnColumn)) {
      const char piece = position.board[ChessIndex(pawnRow, pawnColumn)];
      if (piece == (bySide == 'w' ? 'P' : 'p')) return true;
    }
  }

  constexpr int knightSteps[8][2] = {{-2,-1},{-2,1},{-1,-2},{-1,2},{1,-2},{1,2},{2,-1},{2,1}};
  for (const auto& step : knightSteps) {
    const int nextRow = row + step[0];
    const int nextColumn = column + step[1];
    if (!ChessInside(nextRow, nextColumn)) continue;
    const char piece = position.board[ChessIndex(nextRow, nextColumn)];
    if (piece == (bySide == 'w' ? 'N' : 'n')) return true;
  }

  constexpr int diagonals[4][2] = {{-1,-1},{-1,1},{1,-1},{1,1}};
  for (const auto& step : diagonals) {
    int nextRow = row + step[0];
    int nextColumn = column + step[1];
    while (ChessInside(nextRow, nextColumn)) {
      const char piece = position.board[ChessIndex(nextRow, nextColumn)];
      if (piece != '.') {
        const char lower = static_cast<char>(std::tolower(static_cast<unsigned char>(piece)));
        if ((lower == 'b' || lower == 'q') && ChessOwn(piece, bySide)) return true;
        break;
      }
      nextRow += step[0];
      nextColumn += step[1];
    }
  }

  constexpr int straights[4][2] = {{-1,0},{1,0},{0,-1},{0,1}};
  for (const auto& step : straights) {
    int nextRow = row + step[0];
    int nextColumn = column + step[1];
    while (ChessInside(nextRow, nextColumn)) {
      const char piece = position.board[ChessIndex(nextRow, nextColumn)];
      if (piece != '.') {
        const char lower = static_cast<char>(std::tolower(static_cast<unsigned char>(piece)));
        if ((lower == 'r' || lower == 'q') && ChessOwn(piece, bySide)) return true;
        break;
      }
      nextRow += step[0];
      nextColumn += step[1];
    }
  }

  for (int dr = -1; dr <= 1; dr += 1) {
    for (int dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const int nextRow = row + dr;
      const int nextColumn = column + dc;
      if (!ChessInside(nextRow, nextColumn)) continue;
      const char piece = position.board[ChessIndex(nextRow, nextColumn)];
      if (piece == (bySide == 'w' ? 'K' : 'k')) return true;
    }
  }
  return false;
}

int ChessKingSquare(const ChessPosition& position, char side) {
  const char king = side == 'w' ? 'K' : 'k';
  for (int index = 0; index < 64; index += 1) {
    if (position.board[index] == king) return index;
  }
  return -1;
}

bool ChessInCheck(const ChessPosition& position, char side) {
  const int king = ChessKingSquare(position, side);
  return king >= 0 && ChessAttacked(position, king, ChessOpponent(side));
}

void ChessPush(std::vector<ChessMove>& moves, int from, int to, char promotion, int flags) {
  moves.push_back(ChessMove{from, to, promotion, flags});
}

std::vector<ChessMove> ChessPseudoMoves(const ChessPosition& position) {
  std::vector<ChessMove> moves;
  const char side = position.side;
  for (int from = 0; from < 64; from += 1) {
    const char piece = position.board[from];
    if (!ChessOwn(piece, side)) continue;
    const char lower = static_cast<char>(std::tolower(static_cast<unsigned char>(piece)));
    const int row = ChessRow(from);
    const int column = ChessColumn(from);

    if (lower == 'p') {
      const int dir = side == 'w' ? -1 : 1;
      const int startRow = side == 'w' ? 6 : 1;
      const int promotionRow = side == 'w' ? 0 : 7;
      const int oneRow = row + dir;
      if (ChessInside(oneRow, column)) {
        const int one = ChessIndex(oneRow, column);
        if (position.board[one] == '.') {
          ChessPush(moves, from, one, oneRow == promotionRow ? 'q' : 0, oneRow == promotionRow ? kChessPromotion : 0);
          const int twoRow = row + dir * 2;
          if (row == startRow && ChessInside(twoRow, column)) {
            const int two = ChessIndex(twoRow, column);
            if (position.board[two] == '.') ChessPush(moves, from, two, 0, 0);
          }
        }
      }
      for (const int dc : {-1, 1}) {
        const int nextColumn = column + dc;
        if (!ChessInside(oneRow, nextColumn)) continue;
        const int to = ChessIndex(oneRow, nextColumn);
        if (ChessEnemy(position.board[to], side)) ChessPush(moves, from, to, oneRow == promotionRow ? 'q' : 0, kChessCapture | (oneRow == promotionRow ? kChessPromotion : 0));
        if (to == position.enPassant) ChessPush(moves, from, to, 0, kChessCapture | kChessEnPassant);
      }
      continue;
    }

    if (lower == 'n') {
      constexpr int steps[8][2] = {{-2,-1},{-2,1},{-1,-2},{-1,2},{1,-2},{1,2},{2,-1},{2,1}};
      for (const auto& step : steps) {
        const int nextRow = row + step[0];
        const int nextColumn = column + step[1];
        if (!ChessInside(nextRow, nextColumn)) continue;
        const int to = ChessIndex(nextRow, nextColumn);
        if (!ChessOwn(position.board[to], side)) ChessPush(moves, from, to, 0, ChessEnemy(position.board[to], side) ? kChessCapture : 0);
      }
      continue;
    }

    std::vector<std::array<int, 2>> steps;
    if (lower == 'b' || lower == 'q') {
      steps.push_back({-1, -1});
      steps.push_back({-1, 1});
      steps.push_back({1, -1});
      steps.push_back({1, 1});
    }
    if (lower == 'r' || lower == 'q') {
      steps.push_back({-1, 0});
      steps.push_back({1, 0});
      steps.push_back({0, -1});
      steps.push_back({0, 1});
    }
    if (!steps.empty()) {
      for (const auto& step : steps) {
        int nextRow = row + step[0];
        int nextColumn = column + step[1];
        while (ChessInside(nextRow, nextColumn)) {
          const int to = ChessIndex(nextRow, nextColumn);
          if (ChessOwn(position.board[to], side)) break;
          ChessPush(moves, from, to, 0, ChessEnemy(position.board[to], side) ? kChessCapture : 0);
          if (position.board[to] != '.') break;
          nextRow += step[0];
          nextColumn += step[1];
        }
      }
      continue;
    }

    if (lower == 'k') {
      for (int dr = -1; dr <= 1; dr += 1) {
        for (int dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const int nextRow = row + dr;
          const int nextColumn = column + dc;
          if (!ChessInside(nextRow, nextColumn)) continue;
          const int to = ChessIndex(nextRow, nextColumn);
          if (!ChessOwn(position.board[to], side)) ChessPush(moves, from, to, 0, ChessEnemy(position.board[to], side) ? kChessCapture : 0);
        }
      }
      if (side == 'w' && from == ChessIndex(7, 4) && !ChessInCheck(position, 'w')) {
        if (position.whiteKingCastle && position.board[ChessIndex(7, 5)] == '.' && position.board[ChessIndex(7, 6)] == '.' && !ChessAttacked(position, ChessIndex(7, 5), 'b') && !ChessAttacked(position, ChessIndex(7, 6), 'b')) ChessPush(moves, from, ChessIndex(7, 6), 0, kChessCastle);
        if (position.whiteQueenCastle && position.board[ChessIndex(7, 3)] == '.' && position.board[ChessIndex(7, 2)] == '.' && position.board[ChessIndex(7, 1)] == '.' && !ChessAttacked(position, ChessIndex(7, 3), 'b') && !ChessAttacked(position, ChessIndex(7, 2), 'b')) ChessPush(moves, from, ChessIndex(7, 2), 0, kChessCastle);
      }
      if (side == 'b' && from == ChessIndex(0, 4) && !ChessInCheck(position, 'b')) {
        if (position.blackKingCastle && position.board[ChessIndex(0, 5)] == '.' && position.board[ChessIndex(0, 6)] == '.' && !ChessAttacked(position, ChessIndex(0, 5), 'w') && !ChessAttacked(position, ChessIndex(0, 6), 'w')) ChessPush(moves, from, ChessIndex(0, 6), 0, kChessCastle);
        if (position.blackQueenCastle && position.board[ChessIndex(0, 3)] == '.' && position.board[ChessIndex(0, 2)] == '.' && position.board[ChessIndex(0, 1)] == '.' && !ChessAttacked(position, ChessIndex(0, 3), 'w') && !ChessAttacked(position, ChessIndex(0, 2), 'w')) ChessPush(moves, from, ChessIndex(0, 2), 0, kChessCastle);
      }
    }
  }
  return moves;
}

ChessPosition ChessApply(const ChessPosition& position, ChessMove move) {
  ChessPosition next = position;
  const char piece = next.board[move.from];
  const char captured = next.board[move.to];
  next.board[move.from] = '.';
  if (move.flags & kChessEnPassant) {
    const int capturedPawn = move.to + (position.side == 'w' ? 8 : -8);
    next.board[capturedPawn] = '.';
  }
  char placed = piece;
  if (move.flags & kChessPromotion) placed = position.side == 'w' ? static_cast<char>(std::toupper(move.promotion ? move.promotion : 'q')) : static_cast<char>(std::tolower(move.promotion ? move.promotion : 'q'));
  next.board[move.to] = placed;

  if (move.flags & kChessCastle) {
    if (move.to == ChessIndex(7, 6)) { next.board[ChessIndex(7, 5)] = 'R'; next.board[ChessIndex(7, 7)] = '.'; }
    if (move.to == ChessIndex(7, 2)) { next.board[ChessIndex(7, 3)] = 'R'; next.board[ChessIndex(7, 0)] = '.'; }
    if (move.to == ChessIndex(0, 6)) { next.board[ChessIndex(0, 5)] = 'r'; next.board[ChessIndex(0, 7)] = '.'; }
    if (move.to == ChessIndex(0, 2)) { next.board[ChessIndex(0, 3)] = 'r'; next.board[ChessIndex(0, 0)] = '.'; }
  }

  if (piece == 'K') { next.whiteKingCastle = false; next.whiteQueenCastle = false; }
  if (piece == 'k') { next.blackKingCastle = false; next.blackQueenCastle = false; }
  if (move.from == ChessIndex(7, 0) || move.to == ChessIndex(7, 0) || captured == 'R') next.whiteQueenCastle = false;
  if (move.from == ChessIndex(7, 7) || move.to == ChessIndex(7, 7) || captured == 'R') next.whiteKingCastle = false;
  if (move.from == ChessIndex(0, 0) || move.to == ChessIndex(0, 0) || captured == 'r') next.blackQueenCastle = false;
  if (move.from == ChessIndex(0, 7) || move.to == ChessIndex(0, 7) || captured == 'r') next.blackKingCastle = false;

  next.enPassant = -1;
  if (std::tolower(static_cast<unsigned char>(piece)) == 'p' && std::abs(ChessRow(move.to) - ChessRow(move.from)) == 2) next.enPassant = (move.from + move.to) / 2;
  next.halfmove = (std::tolower(static_cast<unsigned char>(piece)) == 'p' || captured != '.' || (move.flags & kChessEnPassant)) ? 0 : next.halfmove + 1;
  if (position.side == 'b') next.fullmove += 1;
  next.side = ChessOpponent(position.side);
  return next;
}

std::vector<ChessMove> ChessLegalMoves(const ChessPosition& position) {
  std::vector<ChessMove> legal;
  for (const auto& move : ChessPseudoMoves(position)) {
    const ChessPosition next = ChessApply(position, move);
    if (!ChessInCheck(next, position.side)) legal.push_back(move);
  }
  return legal;
}

std::string ChessStatus(const ChessPosition& position, bool& check, std::string& reason) {
  check = ChessInCheck(position, position.side);
  const auto moves = ChessLegalMoves(position);
  if (!moves.empty()) return "playing";
  if (check) {
    reason = "checkmate";
    return position.side == 'w' ? "black-win" : "white-win";
  }
  reason = "stalemate";
  return "draw";
}

int ChessPieceValue(char piece) {
  switch (std::tolower(static_cast<unsigned char>(piece))) {
    case 'p': return 100;
    case 'n': return 320;
    case 'b': return 330;
    case 'r': return 500;
    case 'q': return 900;
    case 'k': return 20000;
    default: return 0;
  }
}

int ChessEvaluate(const ChessPosition& position) {
  int score = 0;
  for (int index = 0; index < 64; index += 1) {
    const char piece = position.board[index];
    if (piece == '.') continue;
    const int row = ChessRow(index);
    const int column = ChessColumn(index);
    const int center = 6 - (std::abs(3 - row) + std::abs(3 - column));
    const int value = ChessPieceValue(piece) + center * 4;
    score += ChessWhite(piece) ? value : -value;
  }
  return position.side == 'w' ? score : -score;
}

int ChessSearch(ChessPosition position, int depth, int alpha, int beta, SearchContext& context, std::uint64_t& nodes) {
  nodes += 1;
  if ((nodes & 2047u) == 0 && Expired(context)) return ChessEvaluate(position);
  bool check = false;
  std::string reason;
  const std::string status = ChessStatus(position, check, reason);
  if (status == "white-win") return position.side == 'w' ? 100000 + depth : -100000 - depth;
  if (status == "black-win") return position.side == 'b' ? 100000 + depth : -100000 - depth;
  if (status == "draw") return 0;
  if (depth <= 0) return ChessEvaluate(position);
  auto moves = ChessLegalMoves(position);
  std::sort(moves.begin(), moves.end(), [](const ChessMove& a, const ChessMove& b) { return (a.flags & kChessCapture) > (b.flags & kChessCapture); });
  int best = -200000;
  for (const auto& move : moves) {
    const int score = -ChessSearch(ChessApply(position, move), depth - 1, -beta, -alpha, context, nodes);
    if (Expired(context)) return best == -200000 ? score : best;
    best = std::max(best, score);
    alpha = std::max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

void ChessFillMoves(ChessRequest* request, const std::vector<ChessMove>& moves) {
  for (const auto& move : moves) {
    request->moveFrom.push_back(move.from);
    request->moveTo.push_back(move.to);
    request->movePromotion.push_back(move.promotion);
    request->moveFlags.push_back(move.flags);
  }
}

void ExecuteChessRequest(ChessRequest* request) {
  const auto startedAt = Clock::now();
  SearchContext context{startedAt + std::chrono::milliseconds(std::max(50, request->timeLimitMs))};
  ChessPosition position = ParseChessFen(request->fen);
  bool check = false;
  std::string reason;
  request->status = ChessStatus(position, check, reason);
  request->check = check;
  request->reason = reason;
  request->resultFen = ChessFen(position);

  if (request->kind == ChessJobKind::LegalMoves) {
    ChessFillMoves(request, ChessLegalMoves(position));
    request->elapsedMs = std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count();
    request->ok = true;
    return;
  }

  if (request->kind == ChessJobKind::ApplyMove) {
    const auto moves = ChessLegalMoves(position);
    auto found = std::find_if(moves.begin(), moves.end(), [&](const ChessMove& move) {
      return move.from == request->fromIndex && move.to == request->toIndex && (!move.promotion || !request->promotion || move.promotion == request->promotion);
    });
    if (found == moves.end()) return;
    position = ChessApply(position, *found);
    request->resultFen = ChessFen(position);
    request->status = ChessStatus(position, request->check, request->reason);
    ChessFillMoves(request, ChessLegalMoves(position));
    request->bestFrom = found->from;
    request->bestTo = found->to;
    request->bestPromotion = found->promotion;
    request->elapsedMs = std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count();
    request->ok = true;
    return;
  }

  auto rootMoves = ChessLegalMoves(position);
  if (rootMoves.empty()) return;
  ChessMove best = rootMoves.front();
  int bestScore = -200000;
  for (int depth = 1; depth <= std::max(1, request->depth); depth += 1) {
    ChessMove depthBest = best;
    int depthScore = -200000;
    std::uint64_t depthNodes = 0;
    for (const auto& move : rootMoves) {
      std::uint64_t nodes = 0;
      const int score = -ChessSearch(ChessApply(position, move), depth - 1, -200000, 200000, context, nodes);
      depthNodes += nodes;
      if (Expired(context)) break;
      if (score > depthScore) {
        depthScore = score;
        depthBest = move;
      }
    }
    if (context.stopped.load(std::memory_order_relaxed)) break;
    best = depthBest;
    bestScore = depthScore;
    request->reachedDepth = depth;
    request->nodes += depthNodes;
  }
  request->bestFrom = best.from;
  request->bestTo = best.to;
  request->bestPromotion = best.promotion;
  request->score = bestScore;
  position = ChessApply(position, best);
  request->resultFen = ChessFen(position);
  request->status = ChessStatus(position, request->check, request->reason);
  ChessFillMoves(request, ChessLegalMoves(position));
  request->timedOut = context.stopped.load(std::memory_order_relaxed);
  request->elapsedMs = std::chrono::duration<double, std::milli>(Clock::now() - startedAt).count();
  request->ok = true;
}

void SetInt(napi_env env, napi_value object, const char* name, int value) {
  napi_value property;
  napi_create_int32(env, value, &property);
  napi_set_named_property(env, object, name, property);
}

void SetDouble(napi_env env, napi_value object, const char* name, double value) {
  napi_value property;
  napi_create_double(env, value, &property);
  napi_set_named_property(env, object, name, property);
}

void SetBool(napi_env env, napi_value object, const char* name, bool value) {
  napi_value property;
  napi_get_boolean(env, value, &property);
  napi_set_named_property(env, object, name, property);
}

void SetString(napi_env env, napi_value object, const char* name, const std::string& value) {
  napi_value property;
  napi_create_string_utf8(env, value.c_str(), value.size(), &property);
  napi_set_named_property(env, object, name, property);
}

void SetChessMoveArray(napi_env env, napi_value object, ChessRequest* request) {
  napi_value moves;
  napi_create_array_with_length(env, request->moveFrom.size(), &moves);
  for (size_t index = 0; index < request->moveFrom.size(); index += 1) {
    napi_value move;
    napi_create_object(env, &move);
    SetInt(env, move, "fromIndex", request->moveFrom[index]);
    SetInt(env, move, "toIndex", request->moveTo[index]);
    SetString(env, move, "from", ChessSquareName(request->moveFrom[index]));
    SetString(env, move, "to", ChessSquareName(request->moveTo[index]));
    SetInt(env, move, "flags", request->moveFlags[index]);
    if (request->movePromotion[index]) SetString(env, move, "promotion", std::string(1, request->movePromotion[index]));
    napi_set_element(env, moves, static_cast<uint32_t>(index), move);
  }
  napi_set_named_property(env, object, "moves", moves);
}

std::string GetStringArg(napi_env env, napi_value value) {
  size_t length = 0;
  napi_get_value_string_utf8(env, value, nullptr, 0, &length);
  std::vector<char> buffer(length + 1, '\0');
  napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &length);
  return std::string(buffer.data(), length);
}

int GetIntArg(napi_env env, napi_value value, int fallback) {
  napi_valuetype type;
  napi_typeof(env, value, &type);
  if (type != napi_number) return fallback;
  int result = fallback;
  napi_get_value_int32(env, value, &result);
  return result;
}

void ExecuteSearch(napi_env, void* data) {
  auto* request = static_cast<SearchRequest*>(data);
  request->result = FindBestMove(request->boardText, request->player, request->depth, request->timeLimitMs, request->threads);
}

void CompleteSearch(napi_env env, napi_status status, void* data) {
  auto* request = static_cast<SearchRequest*>(data);
  napi_value result;
  napi_create_object(env, &result);
  SetBool(env, result, "ok", status == napi_ok);
  SetInt(env, result, "column", request->result.column);
  SetInt(env, result, "score", request->result.score);
  SetInt(env, result, "depth", request->result.depth);
  SetDouble(env, result, "nodes", static_cast<double>(request->result.nodes));
  SetDouble(env, result, "elapsedMs", request->result.elapsedMs);
  SetBool(env, result, "timedOut", request->result.timedOut);
  napi_resolve_deferred(env, request->deferred, result);
  napi_delete_async_work(env, request->work);
  delete request;
}

void ExecuteReversiSearch(napi_env, void* data) {
  auto* request = static_cast<ReversiRequest*>(data);
  request->result = FindBestReversiMove(request->boardText, request->player, request->depth, request->timeLimitMs);
}

void CompleteReversiSearch(napi_env env, napi_status status, void* data) {
  auto* request = static_cast<ReversiRequest*>(data);
  napi_value result;
  napi_create_object(env, &result);
  SetBool(env, result, "ok", status == napi_ok);
  SetInt(env, result, "move", request->result.column);
  SetInt(env, result, "score", request->result.score);
  SetInt(env, result, "depth", request->result.depth);
  SetDouble(env, result, "nodes", static_cast<double>(request->result.nodes));
  SetDouble(env, result, "elapsedMs", request->result.elapsedMs);
  SetBool(env, result, "timedOut", request->result.timedOut);
  napi_resolve_deferred(env, request->deferred, result);
  napi_delete_async_work(env, request->work);
  delete request;
}

void ExecuteCheckersSearch(napi_env, void* data) {
  auto* request = static_cast<CheckersRequest*>(data);
  FindBestCheckersMove(request);
}

void CompleteCheckersSearch(napi_env env, napi_status status, void* data) {
  auto* request = static_cast<CheckersRequest*>(data);
  napi_value result;
  napi_create_object(env, &result);
  SetBool(env, result, "ok", status == napi_ok && request->fromIndex >= 0 && request->toIndex >= 0);
  SetInt(env, result, "fromIndex", request->fromIndex);
  SetInt(env, result, "toIndex", request->toIndex);
  SetInt(env, result, "capturedIndex", request->capturedIndex);
  SetInt(env, result, "score", request->score);
  SetInt(env, result, "depth", request->reachedDepth);
  SetDouble(env, result, "nodes", static_cast<double>(request->nodes));
  SetDouble(env, result, "elapsedMs", request->elapsedMs);
  SetBool(env, result, "timedOut", request->timedOut);
  napi_resolve_deferred(env, request->deferred, result);
  napi_delete_async_work(env, request->work);
  delete request;
}

void ExecuteChessSearch(napi_env, void* data) {
  auto* request = static_cast<ChessRequest*>(data);
  ExecuteChessRequest(request);
}

void CompleteChessSearch(napi_env env, napi_status status, void* data) {
  auto* request = static_cast<ChessRequest*>(data);
  napi_value result;
  napi_create_object(env, &result);
  SetBool(env, result, "ok", status == napi_ok && request->ok);
  SetString(env, result, "fen", request->resultFen);
  SetString(env, result, "status", request->status);
  SetString(env, result, "reason", request->reason);
  SetBool(env, result, "check", request->check);
  SetInt(env, result, "fromIndex", request->bestFrom);
  SetInt(env, result, "toIndex", request->bestTo);
  if (request->bestPromotion) SetString(env, result, "promotion", std::string(1, request->bestPromotion));
  SetInt(env, result, "score", request->score);
  SetInt(env, result, "depth", request->reachedDepth);
  SetDouble(env, result, "nodes", static_cast<double>(request->nodes));
  SetDouble(env, result, "elapsedMs", request->elapsedMs);
  SetBool(env, result, "timedOut", request->timedOut);
  SetChessMoveArray(env, result, request);
  napi_resolve_deferred(env, request->deferred, result);
  napi_delete_async_work(env, request->work);
  delete request;
}

napi_value FindBestMoveBinding(napi_env env, napi_callback_info info) {
  size_t argc = 5;
  napi_value args[5];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "board string is required");
    return nullptr;
  }

  auto* request = new SearchRequest();
  request->boardText = GetStringArg(env, args[0]);
  if (argc > 1) {
    const std::string player = GetStringArg(env, args[1]);
    request->player = player == "R" ? 'R' : 'Y';
  }
  if (argc > 2) request->depth = GetIntArg(env, args[2], 16);
  if (argc > 3) request->timeLimitMs = GetIntArg(env, args[3], 1800);
  if (argc > 4) request->threads = GetIntArg(env, args[4], 0);

  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);

  napi_value resourceName;
  napi_create_string_utf8(env, "connect-four-ai-search", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteSearch, CompleteSearch, request, &request->work);
  napi_queue_async_work(env, request->work);
  return promise;
}

napi_value FindBestReversiMoveBinding(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value args[4];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "board string is required");
    return nullptr;
  }

  auto* request = new ReversiRequest();
  request->boardText = GetStringArg(env, args[0]);
  if (argc > 1) {
    const std::string player = GetStringArg(env, args[1]);
    request->player = player == "R" ? 'R' : 'Y';
  }
  if (argc > 2) request->depth = GetIntArg(env, args[2], 12);
  if (argc > 3) request->timeLimitMs = GetIntArg(env, args[3], 800);

  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);

  napi_value resourceName;
  napi_create_string_utf8(env, "reversi-light-ai-search", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteReversiSearch, CompleteReversiSearch, request, &request->work);
  napi_queue_async_work(env, request->work);
  return promise;
}

napi_value FindBestCheckersMoveBinding(napi_env env, napi_callback_info info) {
  size_t argc = 5;
  napi_value args[5];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "board string is required");
    return nullptr;
  }

  auto* request = new CheckersRequest();
  request->boardText = GetStringArg(env, args[0]);
  if (argc > 1) {
    const std::string side = GetStringArg(env, args[1]);
    request->side = side == "gold" || side == "g" ? 'g' : 'b';
  }
  if (argc > 2) request->depth = GetIntArg(env, args[2], 6);
  if (argc > 3) request->timeLimitMs = GetIntArg(env, args[3], 1200);
  if (argc > 4) request->forcedFrom = GetIntArg(env, args[4], -1);

  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);

  napi_value resourceName;
  napi_create_string_utf8(env, "checkers-light-ai-search", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteCheckersSearch, CompleteCheckersSearch, request, &request->work);
  napi_queue_async_work(env, request->work);
  return promise;
}

napi_value ChessLegalMovesBinding(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "fen string is required");
    return nullptr;
  }

  auto* request = new ChessRequest();
  request->kind = ChessJobKind::LegalMoves;
  request->fen = GetStringArg(env, args[0]);

  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);
  napi_value resourceName;
  napi_create_string_utf8(env, "chess-mini-legal-moves", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteChessSearch, CompleteChessSearch, request, &request->work);
  napi_queue_async_work(env, request->work);
  return promise;
}

napi_value ChessApplyMoveBinding(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value args[4];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 3) {
    napi_throw_type_error(env, nullptr, "fen, fromIndex and toIndex are required");
    return nullptr;
  }

  auto* request = new ChessRequest();
  request->kind = ChessJobKind::ApplyMove;
  request->fen = GetStringArg(env, args[0]);
  request->fromIndex = GetIntArg(env, args[1], -1);
  request->toIndex = GetIntArg(env, args[2], -1);
  if (argc > 3) {
    const std::string promotion = GetStringArg(env, args[3]);
    request->promotion = promotion.empty() ? 'q' : static_cast<char>(std::tolower(static_cast<unsigned char>(promotion[0])));
  }

  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);
  napi_value resourceName;
  napi_create_string_utf8(env, "chess-mini-apply-move", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteChessSearch, CompleteChessSearch, request, &request->work);
  napi_queue_async_work(env, request->work);
  return promise;
}

napi_value ChessBestMoveBinding(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "fen string is required");
    return nullptr;
  }

  auto* request = new ChessRequest();
  request->kind = ChessJobKind::BestMove;
  request->fen = GetStringArg(env, args[0]);
  if (argc > 1) request->depth = GetIntArg(env, args[1], 4);
  if (argc > 2) request->timeLimitMs = GetIntArg(env, args[2], 1500);

  napi_value promise;
  napi_create_promise(env, &request->deferred, &promise);
  napi_value resourceName;
  napi_create_string_utf8(env, "chess-mini-best-move", NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteChessSearch, CompleteChessSearch, request, &request->work);
  napi_queue_async_work(env, request->work);
  return promise;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value findBestMove;
  napi_create_function(env, "findBestMove", NAPI_AUTO_LENGTH, FindBestMoveBinding, nullptr, &findBestMove);
  napi_set_named_property(env, exports, "findBestMove", findBestMove);
  napi_value findBestReversiMove;
  napi_create_function(env, "findBestReversiMove", NAPI_AUTO_LENGTH, FindBestReversiMoveBinding, nullptr, &findBestReversiMove);
  napi_set_named_property(env, exports, "findBestReversiMove", findBestReversiMove);
  napi_value findBestCheckersMove;
  napi_create_function(env, "findBestCheckersMove", NAPI_AUTO_LENGTH, FindBestCheckersMoveBinding, nullptr, &findBestCheckersMove);
  napi_set_named_property(env, exports, "findBestCheckersMove", findBestCheckersMove);
  napi_value chessLegalMoves;
  napi_create_function(env, "chessLegalMoves", NAPI_AUTO_LENGTH, ChessLegalMovesBinding, nullptr, &chessLegalMoves);
  napi_set_named_property(env, exports, "chessLegalMoves", chessLegalMoves);
  napi_value chessApplyMove;
  napi_create_function(env, "chessApplyMove", NAPI_AUTO_LENGTH, ChessApplyMoveBinding, nullptr, &chessApplyMove);
  napi_set_named_property(env, exports, "chessApplyMove", chessApplyMove);
  napi_value chessBestMove;
  napi_create_function(env, "chessBestMove", NAPI_AUTO_LENGTH, ChessBestMoveBinding, nullptr, &chessBestMove);
  napi_set_named_property(env, exports, "chessBestMove", chessBestMove);
  return exports;
}

} // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
