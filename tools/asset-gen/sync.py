"""把 tools/asset-gen/out/ 的产物同步进 assets/Game/image/。

覆盖是不可逆的——原素材会被替换。默认先备份到 tools/asset-gen/backup/。

    python -I tools/asset-gen/sync.py            # 备份原图 + 覆盖
    python -I tools/asset-gen/sync.py --dry-run  # 只列出将被替换的文件
"""

import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
TARGET = os.path.join(HERE, '..', '..', 'assets', 'Game', 'image')
BACKUP = os.path.join(HERE, 'backup')


def main() -> int:
    dry = '--dry-run' in sys.argv
    files = []
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            if f.endswith('.png'):
                src = os.path.join(dp, f)
                rel = os.path.relpath(src, OUT)
                files.append((rel, src, os.path.join(TARGET, rel)))

    missing = [rel for rel, _, dst in files if not os.path.exists(dst)]
    print(f'将同步 {len(files)} 张素材 -> {os.path.relpath(TARGET)}')
    if missing:
        print(f'其中 {len(missing)} 张在目标目录不存在（新增）:')
        for m in missing[:10]:
            print('  ', m)

    if dry:
        print('（dry-run，未写入）')
        return 0

    # 备份会被覆盖的原图
    backed = 0
    for rel, _, dst in files:
        if os.path.exists(dst):
            b = os.path.join(BACKUP, rel)
            os.makedirs(os.path.dirname(b), exist_ok=True)
            shutil.copy2(dst, b)
            backed += 1
    print(f'已备份 {backed} 张原图 -> {os.path.relpath(BACKUP)}')

    for rel, src, dst in files:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    print(f'已覆盖 {len(files)} 张素材')
    print('提示：Cocos 需重新导入资源；.meta 未改动，uuid 保持不变。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
