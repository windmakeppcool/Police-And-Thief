declare global {
    interface IBundleUrl {
        /** * 子包名 */ bundleName: string,
        /** * 资源路径 */ bundlePath: string,
        /** 缓存关键字 */ bundleId: string,
    }
}

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