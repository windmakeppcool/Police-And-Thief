import { BL } from "db://assets/GScript/core/res/ResConst";

export class JsonsCfg {
    static level = (key: string | number) => BL(`Jsons/level/${key}`, "GameBN");
}