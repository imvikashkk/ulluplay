import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { activeGateway } from '@/lib/paymentGateway';

export async function GET() {
  try {
    const res = await pool.query(
      `SELECT id, name, price, original_price, duration_days, description
       FROM plans WHERE is_active = true ORDER BY price ASC`,
    );
    // gateway lets the subscription page show the right payment hints (PhonePe/Paytm only for Paytm UPI)
    return NextResponse.json({ success: true, data: res.rows, gateway: activeGateway() });
  } catch (err) {
    console.error('plans error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 },
    );
  }
}
