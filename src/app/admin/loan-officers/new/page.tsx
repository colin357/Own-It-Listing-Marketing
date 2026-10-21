import { LoanOfficerForm } from "@/components/admin/LoanOfficerForm";

export default function NewLoanOfficerPage() {
  return (
    <>
      <h1>Add loan officer</h1>
      <LoanOfficerForm slug={null} initial={{}} />
    </>
  );
}
