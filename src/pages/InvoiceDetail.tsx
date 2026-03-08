import { useNavigate } from 'react-router-dom';

export default function InvoiceDetail() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-slate-400 text-sm">InvoiceDetail — coming soon</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-xs text-blue-400 hover:text-blue-300">Go back</button>
    </div>
  );
}
