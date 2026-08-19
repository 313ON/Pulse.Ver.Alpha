import type { Program } from "../../../domain/program/types";
import type { OrganizationalContextSnapshot } from "../OrganizationalContext";
import {
  projectProgramThroughOrganizationalGovernance,
  type GovernedProgramProjection
} from "./ProgramGovernanceGate";
import type {
  OrganizationalGovernanceIdentityReadPort,
  OrganizationalGovernanceInput
} from "./OrganizationalGovernance";
import type { BusinessRole, Expertise } from "../../../domain/organization";

export type ApprovedOrganizationalCanonicalAuthority = {
  listBusinessRoles(): readonly BusinessRole[];
  listExpertise(): readonly Expertise[];
};

export type ProductionOrganizationalGovernanceInput = {
  snapshot: OrganizationalContextSnapshot;
  identity: OrganizationalGovernanceIdentityReadPort;
  assignmentContexts?: OrganizationalGovernanceInput["assignmentContexts"];
  assignmentOrigins?: OrganizationalGovernanceInput["assignmentOrigins"];
  identityOrigins?: OrganizationalGovernanceInput["identityOrigins"];
  identityProvenance?: OrganizationalGovernanceInput["identityProvenance"];
};

/**
 * Explicit production boundary. The canonical role/expertise authority is
 * fixed when this entry point is composed and cannot be supplied per call.
 */
export class ProductionOrganizationalGovernance {
  constructor(
    canonicalAuthority: ApprovedOrganizationalCanonicalAuthority
  ) {
    const roles = new Map(canonicalAuthority.listBusinessRoles().map((item) => [item.id, item]));
    const expertise = new Map(canonicalAuthority.listExpertise().map((item) => [item.id, item]));
    this.canonicalAuthority = {
      getBusinessRole: (id) => roles.get(id),
      getExpertise: (id) => expertise.get(id)
    };
  }

  private readonly canonicalAuthority: {
    getBusinessRole(id: string): BusinessRole | undefined;
    getExpertise(id: string): Expertise | undefined;
  };

  evaluateProgram(
    program: Program,
    input: ProductionOrganizationalGovernanceInput
  ): GovernedProgramProjection {
    return projectProgramThroughOrganizationalGovernance(program, {
      ...input,
      canonicalAuthority: this.canonicalAuthority
    });
  }
}
