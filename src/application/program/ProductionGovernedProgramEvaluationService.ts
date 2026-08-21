import type { SessionUser } from "../../server/auth";
import { SQLiteOrganizationRepository } from "../../server/organization/OrganizationRepository";
import { SQLiteOrganizationalContextReadRepository } from "../../server/organization/OrganizationalContextReadRepository";
import { OrganizationalContextBuilder } from "../organization/OrganizationalContextBuilder";
import { createOrganizationalContextSnapshot } from "../organization/OrganizationalContextHardening";
import { ProductionOrganizationalGovernance } from "../organization/governance/ProductionOrganizationalGovernance";
import type { Program } from "../../domain/program";
import {
  GovernedProgramEvaluationService,
  type GovernedProgramEvaluationResult
} from "./GovernedProgramEvaluationService";
import { getPlanningContext, type PlanningContext } from "../../domain/planning";

export class ProductionGovernedProgramEvaluationService {
  constructor(private readonly planning: PlanningContext = getPlanningContext()) {}

  private readonly organization = new SQLiteOrganizationRepository();
  private readonly readSide = new SQLiteOrganizationalContextReadRepository();
  private readonly builder = new OrganizationalContextBuilder({
    organization: this.organization,
    readSide: this.readSide
  });
  private readonly governance = new ProductionOrganizationalGovernance(this.organization);
  private readonly evaluation = new GovernedProgramEvaluationService();

  evaluate(
    program: Program,
    user: SessionUser,
    generatedAt: string
  ): GovernedProgramEvaluationResult {
    const snapshot = createOrganizationalContextSnapshot(
      this.builder.build({ type: "PROGRAM_ENTITY", id: program.id }, user, generatedAt)
    );
    const assignmentContexts: Record<string, NonNullable<Parameters<ProductionOrganizationalGovernance["evaluateProgram"]>[1]["assignmentContexts"]>[string]> = {};
    for (const entity of program.goals.flatMap((goal) =>
      goal.objectives.flatMap((objective) =>
        objective.activities.flatMap((activity) => [activity, ...activity.actions])
      )
    )) {
      for (const assignment of entity.assignments) {
        const subject = assignment.entityType === "PERSON"
          ? { type: "PERSON" as const, id: assignment.entityId }
          : { type: "UNIT" as const, id: assignment.entityId };
        const context = this.builder.build(subject, user, generatedAt);
        assignmentContexts[assignment.id] = {
          person: context.person,
          position: context.position,
          unit: context.unit,
          authorizationScope: context.authorizationScope
        };
      }
    }
    return this.evaluation.evaluate({
      program,
      organizationalGovernance: {
        boundary: this.governance,
        input: {
          snapshot,
          identity: this.organization,
          assignmentContexts
        }
      },
      today: this.planning.today,
      evaluationGeneratedAt: generatedAt
    });
  }
}
