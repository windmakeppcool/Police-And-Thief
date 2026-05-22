export class CommandHistory {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
    }
    push(cmd) {
        this.undoStack.push(cmd);
        this.redoStack.length = 0;
    }
    canUndo() {
        return this.undoStack.length > 0;
    }
    canRedo() {
        return this.redoStack.length > 0;
    }
    undo() {
        const cmd = this.undoStack.pop();
        if (!cmd)
            return false;
        cmd.revert();
        this.redoStack.push(cmd);
        return true;
    }
    redo() {
        const cmd = this.redoStack.pop();
        if (!cmd)
            return false;
        cmd.apply();
        this.undoStack.push(cmd);
        return true;
    }
}
