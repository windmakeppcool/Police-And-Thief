import { BL } from "db://assets/GScript/core/modules/res/ResConst";


export class JsonsCfg {
    static level = (key: string | number) => BL(`Jsons/level/${key}`, "Match3BN");
}