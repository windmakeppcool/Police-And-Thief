export interface Command {
  apply(): void;
  revert(): void;
}

