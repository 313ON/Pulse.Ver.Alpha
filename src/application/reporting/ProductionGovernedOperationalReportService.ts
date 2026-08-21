import type { SessionUser } from "../../server/auth";
import { SQLiteOrganizationRepository } from "../../server/organization/OrganizationRepository";
import { SQLiteOrganizationalContextReadRepository } from "../../server/organization/OrganizationalContextReadRepository";
import { OrganizationalContextBuilder } from "../organization/OrganizationalContextBuilder";
import { createOrganizationalContextSnapshot } from "../organization/OrganizationalContextHardening";
import { ProductionGovernedProgramEvaluationService } from "../program/ProductionGovernedProgramEvaluationService";
import type { Program } from "../../domain/program";
import type { GovernedOperationalReport, GovernedOperationalReportFilters } from "./contracts";
import { GovernedOperationalReportAdapter } from "./GovernedOperationalReportAdapter";
import { getPlanningContext, type PlanningContext } from "../../domain/planning";

export class ProductionGovernedOperationalReportService {
  constructor(private readonly planning: PlanningContext = getPlanningContext()) {}

  private readonly organization = new SQLiteOrganizationRepository();
  private readonly readSide = new SQLiteOrganizationalContextReadRepository();
  private readonly builder = new OrganizationalContextBuilder({
    organization: this.organization,
    readSide: this.readSide
  });
  private readonly evaluation = new ProductionGovernedProgramEvaluationService();
  private readonly adapter = new GovernedOperationalReportAdapter();

  report(
    program: Program,
    user: SessionUser,
    generatedAt: string,
    filters: GovernedOperationalReportFilters = {}
  ): GovernedOperationalReport {
    const governedEvaluation = this.evaluation.evaluate(program, user, generatedAt);
    const organizationalContext = createOrganizationalContextSnapshot(
      this.builder.build({ type: "PROGRAM_ENTITY", id: program.id }, user, generatedAt)
    );
    return this.adapter.project({
      governedEvaluation,
      organizationalContext,
      authorization: user,
      filters,
      generatedAt,
      planYear: this.planning.planYear
    });
  }
}
