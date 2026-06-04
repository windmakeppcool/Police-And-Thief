import { js } from "cc";

declare global {
    interface IBundleUrl {
        /** * 子包名 */ bundleName: string,
        /** * 资源路径 */ bundlePath: string,
        /** 缓存关键字 */ bundleId: string,
    }
}

const g_UIClass2Url = new Map<any, IBundleUrl>();
const g_Key2Url = new Map<string, IBundleUrl>();

/**
 * 创建 BundleUrl 对象
 * @param url 资源路径
 * @param k 缓存关键字
 * @param bundleName Asset Bundle 名称
 * @returns BundleUrl 对象
 */

export function BL(url: string, bundleName: string, k?: string): IBundleUrl {
    let obj: IBundleUrl = Object.create(null);
    obj.bundleName = bundleName;
    obj.bundlePath = url;
    obj.bundleId = `${bundleName}${url}`;
    return obj;
}

export function registerBUrlByCfg(cfg: { [uiClassName: string]: IBundleUrl }) {
    for (let uiClassName in cfg) {
        console.log(`注册预制体: ${uiClassName}`);
        g_Key2Url.set(uiClassName, cfg[uiClassName]);
    }
}

export function getUIClassByUrl(uiClass: any): IBundleUrl {
    if (!uiClass) throw new Error("uiClass 不能为空");
    if (g_UIClass2Url.has(uiClass)) return g_UIClass2Url.get(uiClass);

    let uiClassName: string;
    if (typeof uiClass === 'string') {
        uiClassName = uiClass;
    } else {
        uiClassName = js.getClassName(uiClass);
    }

    let bUrl = g_Key2Url.get(uiClassName);
    if (!bUrl) {
        console.error(`UI 类 ${uiClassName} 未配置 PrefabCfg`);
        throw new Error(`UI 类 ${uiClassName} 未配置 PrefabCfg`);
    }

    g_UIClass2Url.set(uiClass, bUrl);
    console.log(`获取预制体: ${uiClassName}`);
    return bUrl;
}