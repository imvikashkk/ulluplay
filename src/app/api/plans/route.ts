import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [res, membersRes] = await Promise.all([
      pool.query(
        `SELECT id, name, price, original_price, duration_days, description
         FROM plans WHERE is_active = true ORDER BY price ASC`,
      ),
      // Real count for the trust line on the plans page — never a made-up number
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int AS n FROM subscriptions
         WHERE status = 'active' AND end_date > NOW()`,
      ),
    ]);
    return NextResponse.json({ success: true, data: res.rows, members: membersRes.rows[0].n });
  } catch (err) {
    console.error('plans error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 },
    );
  }
}
