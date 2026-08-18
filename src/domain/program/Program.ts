import type { Goal, ProgramEntity } from "./types";

export type Program = ProgramEntity & {
  type: "program";
  goals: Goal[];
};
