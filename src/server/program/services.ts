import { ProgramCommandService, ProgramQueryService } from "../../application/program";
import { createProgramRepositoryPorts } from "./ProgramRepositoryAdapter";

export function createProgramServices() {
  const ports = createProgramRepositoryPorts();
  return {
    ports,
    query: new ProgramQueryService(ports),
    commands: new ProgramCommandService(ports)
  };
}
