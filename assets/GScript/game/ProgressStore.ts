/**
 * 本机进度与设置：通关记录、音效/振动开关、音量。
 * 存储统一走 gCtrl.platform，不直接碰 localStorage。
 */

const STORAGE_KEY = 'patrol_progress_v1';

type ProgressData = {
    /** 已通关关卡 id，按通关顺序排列且去重 */
    cleared: string[];
    sound: boolean;
    vibrate: boolean;
    /** 音效音量 0..1 */
    volume: number;
    /** level_01 分步新手引导是否已完成；旧版本存档无此字段，按 false 处理 */
    guideDone: boolean;
};

function defaultData(): ProgressData {
    return { cleared: [], sound: true, vibrate: true, volume: 0.65, guideDone: false };
}

class ProgressStoreImpl {
    private data: ProgressData = defaultData();

    /** 从平台存储加载；解析失败或任何异常都回退默认值，不抛出 */
    async load(): Promise<void> {
        try {
            const raw = await gCtrl.platform.getStorage<unknown>(STORAGE_KEY);
            this.data = raw === null ? defaultData() : this.normalize(raw);
        } catch (e) {
            console.error('[ProgressStore] 读取进度失败，使用默认值', e);
            this.data = defaultData();
        }
    }

    /** 把外部数据校正为合法结构，非法字段按默认值处理 */
    private normalize(raw: unknown): ProgressData {
        const d = defaultData();
        if (typeof raw !== 'object' || raw === null) return d;
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.cleared)) {
            // 只接受非空字符串，有序去重
            const seen = new Set<string>();
            for (const id of obj.cleared) {
                if (typeof id === 'string' && id.length > 0 && !seen.has(id)) {
                    seen.add(id);
                    d.cleared.push(id);
                }
            }
        }
        if (typeof obj.guideDone === 'boolean') d.guideDone = obj.guideDone;
        if (typeof obj.sound === 'boolean') d.sound = obj.sound;
        if (typeof obj.vibrate === 'boolean') d.vibrate = obj.vibrate;
        if (typeof obj.volume === 'number' && Number.isFinite(obj.volume)) {
            d.volume = Math.min(1, Math.max(0, obj.volume));
        }
        return d;
    }

    /** 写入平台存储；任何异常都吞掉，不能影响游戏流程 */
    private save(): void {
        try {
            void gCtrl.platform.setStorage(STORAGE_KEY, this.data).catch((e: unknown) => {
                console.error('[ProgressStore] 写入进度失败', e);
            });
        } catch (e) {
            console.error('[ProgressStore] 写入进度异常', e);
        }
    }

    isCleared(id: string): boolean {
        return this.data.cleared.indexOf(id) >= 0;
    }

    /** 标记通关：保持有序去重并立即保存 */
    markCleared(id: string): void {
        if (this.data.cleared.indexOf(id) >= 0) return;
        this.data.cleared.push(id);
        this.save();
    }

    get clearedCount(): number {
        return this.data.cleared.length;
    }

    /** level_01 分步新手引导是否已完成 */
    isGuideDone(): boolean {
        return this.data.guideDone;
    }

    /** 标记引导完成并立即保存；重复设置不重复写盘 */
    setGuideDone(value: boolean): void {
        if (this.data.guideDone === value) return;
        this.data.guideDone = value;
        this.save();
    }

    /**
     * 从 0 开始的关卡序号是否解锁：第 1 关（index 0）默认开放，
     * 通关 N 关后前 N+1 关可进。
     */
    isUnlockedIndex(index: number): boolean {
        return index <= this.data.cleared.length;
    }

    getSound(): boolean {
        return this.data.sound;
    }

    setSound(value: boolean): void {
        this.data.sound = value;
        this.save();
    }

    getVibrate(): boolean {
        return this.data.vibrate;
    }

    setVibrate(value: boolean): void {
        this.data.vibrate = value;
        this.save();
    }

    getVolume(): number {
        return this.data.volume;
    }

    setVolume(value: number): void {
        this.data.volume = Math.min(1, Math.max(0, value));
        this.save();
    }

    /** 清空本机记录并恢复默认设置 */
    clearAll(): void {
        this.data = defaultData();
        this.save();
    }
}

/** 单例：模块加载期不访问 gCtrl，首次 load/保存时平台已就绪 */
export const ProgressStore = new ProgressStoreImpl();
