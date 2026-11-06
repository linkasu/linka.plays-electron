"""Skip automatic publication only for the reviewed licensing snapshot.

The exemption matches only this snapshot directly above BASE; normal runtime
changes and explicit workflow_dispatch retain their publication behavior.
shortcut: this exemption is snapshot-bound; refresh BASE/hashes if rebased.
"""
import hashlib
import os
from pathlib import Path
import subprocess
import sys

BASE = '723aa6b63976078c710cb9a4069bcf3fdb4e2844'
EXPECTED = {
    ".github/workflows/web-preview.yml": "85195ea57a3b5f8583072e4e7fc0357a2d58c2cd81dadfecbce860b7b716e388",
    ".github/workflows/windows-main-release.yml": "c820405f4f214c9ca41f9ad7ff040e3ab6d387614192e176f1b3bf4a768da63c",
    "LICENSE": "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986",
    "docs/licensing.md": "debfc32472534d2f4d5bad15a009df740d07341b1b83790b570d21786dbc8e8c"
}
SCRIPT = '.github/scripts/licensing-deployment-guard.py'


def licensing_only(parent, files):
    return parent == BASE and files == EXPECTED


def self_test():
    assert licensing_only(BASE, dict(EXPECTED))
    assert not licensing_only('another-parent', dict(EXPECTED))
    assert not licensing_only(BASE, {**EXPECTED, 'runtime.py': 'changed'})
    assert not licensing_only(BASE, {**EXPECTED, 'package.json': 'changed'})
    assert not licensing_only(BASE, {})
    print('licensing deployment guard: 5 checks passed')


def should_deploy():
    event = os.environ.get('GITHUB_EVENT_NAME')
    if event not in ('push', 'workflow_run', 'pull_request') or os.environ.get('GITHUB_REF_TYPE') == 'tag':
        return True
    parent = subprocess.check_output(['git', 'rev-parse', 'HEAD^'], text=True).strip()
    if parent != BASE:
        return True
    paths = subprocess.check_output(
        ['git', 'diff', '--name-only', '-z', BASE, 'HEAD']
    ).decode().split('\0')[:-1]
    if SCRIPT not in paths:
        return True
    files = {
        path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
        for path in paths if path != SCRIPT
    }
    return not licensing_only(parent, files)


if __name__ == '__main__':
    if '--self-test' in sys.argv:
        self_test()
    else:
        deploy = should_deploy()
        print('deploy=' + str(deploy).lower())
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('deploy=' + str(deploy).lower() + '\n')
