import { LevelData } from "./GameTypes";


export class GameSession {
    constructor(
        private readonly level: LevelData
    ) { }

    getLevel(): LevelData {
        return this.level;
    }
    
}