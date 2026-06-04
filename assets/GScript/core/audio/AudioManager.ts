import { _decorator, AudioClip, AudioSource, Component, director, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager = null!;

    /** AudioSource 挂载在此节点上 */
    private m_AttachNode: Node = null!;
    /** AudioSource 组件 */
    private m_AudioSource: AudioSource = null!;

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

    async playMusic(bUrl: IBundleUrl) {
        const audioClip = await gCtrl.res.loadAssetAsync(bUrl, AudioClip);
        let audioSource = this.m_AudioSource;
        audioSource.clip = audioClip;
        audioSource.loop = true;
        audioSource.play();
    }
}


