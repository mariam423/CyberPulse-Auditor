import { redirect } from 'next/navigation';

/**
 * Root entry — the public landing/download page with the interactive
 * CLI installer widget. Authenticated users navigate to /dashboard from
 * the landing nav (single-user local deployment posture).
 */
export default function Home() {
  redirect('/download');
}
