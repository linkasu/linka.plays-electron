/** Run as a bound Apps Script in the LINKa Plays tester spreadsheet. */
function updateTesterSheetLinks() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet.getId() !== "1kZsECVOIo2k-aQNXEF7ZHnKEPYpJxocrFJEhUA1Ymc8") {
    throw new Error("Wrong spreadsheet");
  }
  const games = spreadsheet.getSheetByName("Правки");
  const instructions = spreadsheet.getSheetByName("Как заполнять");
  if (games.getSheetId() !== 1025920802 || !instructions) throw new Error("Wrong sheets");

  const rows = games.getRange("A1:R271").getDisplayValues();
  const links = games.getRange("C1:C271").getRichTextValues();
  const changes = [];
  for (let index = 11; index < rows.length; index++) {
    const label = rows[index][2];
    if (!label.startsWith("▶ ")) continue;
    const id = rows[index][17];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`Invalid game ID on row ${index + 1}`);
    }
    const target = `https://linkasu.github.io/linka.plays-electron/open.html?game=${id}`;
    const previous = links[index][0]?.getLinkUrl();
    if (previous !== target && !previous?.startsWith("https://linkasu.github.io/linka.plays-electron/")) {
      throw new Error(`Unexpected original link on row ${index + 1}: ${previous}`);
    }
    changes.push({ row: index + 1, label, target, previous });
  }
  if (changes.length !== 136) throw new Error(`Expected 136 games, found ${changes.length}`);

  if (!spreadsheet.getSheetByName("Правки до ссылок Electron")) {
    games.copyTo(spreadsheet).setName("Правки до ссылок Electron").hideSheet();
  }
  if (!spreadsheet.getSheetByName("Инструкция до ссылок Electron")) {
    instructions.copyTo(spreadsheet).setName("Инструкция до ссылок Electron").hideSheet();
  }
  for (const { row, label, target, previous } of changes) {
    if (previous === target) continue;
    games
      .getRange(row, 3)
      .setRichTextValue(SpreadsheetApp.newRichTextValue().setText(label).setLinkUrl(target).build());
  }
  instructions
    .getRange("B6")
    .setValue(
      "Нажмите на синюю ссылку «▶ Открыть игру». На странице игры нажмите «Открыть в приложении» и разрешите браузеру запустить «Линка играй». Если программа не установлена, скачайте её там же, установите и нажмите кнопку снова. Игру проверяйте в программе с Tobii.",
    );
  instructions
    .getRange("B14")
    .setValue(
      "Ссылки «▶ Открыть игру» открывают установленное Windows-приложение с Tobii. Браузерные ссылки на превью PR предназначены разработчикам: в браузере управление только мышью.",
    );
  SpreadsheetApp.flush();
  Logger.log(`Checked ${changes.length} games; updated ${changes.filter((item) => item.previous !== item.target).length} links.`);
}
