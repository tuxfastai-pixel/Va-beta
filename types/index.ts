export interface Job {
  id?: string | number;
  title?: string;
  company?: string;
  platform?: string;
  score: number;
  description?: string;
  budget?: number;
  type?: string;
  remote?: boolean;
  link?: string;
  platformWeight?: number;
  requiresPortfolio?: boolean;
  requiresManualAnswers?: boolean;
  longTerm?: boolean;
  isGovernmentTender?: boolean;
  pay_amount?: number;
}
