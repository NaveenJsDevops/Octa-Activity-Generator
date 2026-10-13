import { redirect } from 'next/navigation';

export default function TopicsRoot() {
  redirect('/topics/generate');
}
