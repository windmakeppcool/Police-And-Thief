import { _decorator, AudioClip, AudioSource, Component, director, isValid, Node } from 'cc';
const { ccclass } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager = null!;

    /** AudioSource 挂载在此节点上 */
    private m_AttachNode: Node = null!;
    /** AudioSource 组件 */
    private m_AudioSource: AudioSource = null!;
    /** 音效开关；AudioSource 尚未就绪时先记录，取到后懒应用 */
    private m_SoundEnabled = true;
    /** 音量 0..1；AudioSource 尚未就绪时先记录，取到后懒应用 */
    private m_Volume = 1;
    /** 已预加载的短音效：key -> AudioClip，与循环 BGM 共用同一个 AudioSource 播放 */
    private readonly m_SfxClips = new Map<string, AudioClip>();

    /** 获取单例的接口 */
    static getInstance() {
        if (this._instance === null) {
            this._instance = new AudioManager();
        }
        return this._instance;
    }

    private constructor() {
        super();
        this.m_AttachNode = director.getScene().getChildByName("Canvas");
        this.m_AudioSource = this.m_AttachNode.addComponent(AudioSource);
    }

    /** 音效开关：关闭时静音，恢复时应用回音量 */
    setSoundEnabled(enabled: boolean): void {
        this.m_SoundEnabled = enabled;
        this.applyAudio();
    }

    /** 设置音量（夹取 0..1）；音效关闭期间仍记录，恢复后生效 */
    setVolume(volume: number): void {
        this.m_Volume = Math.min(1, Math.max(0, volume));
        this.applyAudio();
    }

    /** 把待应用的开关/音量同步到 AudioSource */
    private applyAudio(): void {
        const audioSource = this.m_AudioSource;
        if (!audioSource) return;
        audioSource.volume = this.m_SoundEnabled ? this.m_Volume : 0;
    }

    /**
     * 预加载短音效。音效随 GameBN 常驻，参照 DesignAssets 只在首次加载成功时 addRef 一次，
     * 之后 bundle 缓存命中不再重复 addRef；同一 key 不重复加载，单个失败只告警不抛出。
     */
    async preloadSfx(entries: { key: string, bUrl: IBundleUrl }[]): Promise<void> {
        await Promise.all(entries.map(async ({ key, bUrl }) => {
            if (this.m_SfxClips.has(key)) return;
            const clip = await gCtrl.res.loadAssetAsync(bUrl, AudioClip);
            if (!clip) {
                console.warn(`[AudioManager] 音效预加载失败: ${key}`);
                return;
            }
            // 并发预加载同一 key 时，后回来的结果直接丢弃，避免覆盖已 addRef 的实例
            if (this.m_SfxClips.has(key)) return;
            clip.addRef();
            this.m_SfxClips.set(key, clip);
        }));
    }

    /**
     * 播放一发短音效：未加载/开关关闭/音量 0/AudioSource 不可用时安全 no-op。
     * 与循环 BGM 共用同一音量与开关语义，playOneShot 不影响正在播放的 BGM。
     */
    playSfx(key: string): void {
        if (!this.m_SoundEnabled || this.m_Volume <= 0) return;
        const clip = this.m_SfxClips.get(key);
        const audioSource = this.m_AudioSource;
        if (!clip || !audioSource || !isValid(audioSource)) return;
        audioSource.playOneShot(clip, this.m_Volume);
    }

    async playMusic(bUrl: IBundleUrl) {
        const audioClip = await gCtrl.res.loadAssetAsync(bUrl, AudioClip);
        let audioSource = this.m_AudioSource;
        audioSource.clip = audioClip;
        audioSource.loop = true;
        // 播放前应用已记录的开关/音量，避免设置早于首支曲子时丢失
        this.applyAudio();
        audioSource.play();
    }
}


