import React from 'react';
import { SeniorAccountingOrchestrator } from './SeniorAccountingOrchestrator';
import { AccountingEntry, CompanyProfile, AccountingFirmProfile, ChileIndicators, DteDocument, EmployeePayroll, F29Declaration, LeaseContract, BankStatementMovement } from '../types';
import { EMPTY_FIRM, NO_CLIENT_PLACEHOLDER } from '../config/emptyProfiles';
import { DEFAULT_INDICATORS } from '../utils/chileanAccounting';

export interface AccountingLedgerProps {
  entries: AccountingEntry[];
  onAddEntry: (entry: AccountingEntry) => void;
  company?: CompanyProfile;
  firm?: AccountingFirmProfile;
  indicators?: ChileIndicators;
  dtes?: DteDocument[];
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  leases?: LeaseContract[];
  bankStatements?: BankStatementMovement[];
}

export const AccountingLedger: React.FC<AccountingLedgerProps> = (props) => {
  return (
    <SeniorAccountingOrchestrator
      company={props.company || (NO_CLIENT_PLACEHOLDER as any)}
      firm={props.firm || EMPTY_FIRM}
      indicators={props.indicators || DEFAULT_INDICATORS}
      entries={props.entries}
      onAddEntry={props.onAddEntry}
      dtes={props.dtes || []}
      payrolls={props.payrolls || []}
      f29={props.f29}
      leases={props.leases || []}
      bankStatements={props.bankStatements || []}
    />
  );
};

export default AccountingLedger;
