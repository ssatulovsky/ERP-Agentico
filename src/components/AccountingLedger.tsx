import React from 'react';
import { SeniorAccountingOrchestrator } from './SeniorAccountingOrchestrator';
import { AccountingEntry, CompanyProfile, AccountingFirmProfile, ChileIndicators, DteDocument, EmployeePayroll, F29Declaration, LeaseContract, BankStatementMovement } from '../types';
import { initialCompanyProfile, seedFirm } from '../data/seedData';
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
      company={props.company || initialCompanyProfile}
      firm={props.firm || seedFirm}
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
