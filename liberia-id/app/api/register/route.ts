import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { first_name, last_name, dob, guardian_phone, school, grade } = body;

    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    // Call the database function we created
    const { data, error } = await supabase.rpc('register_student', {
      p_first_name: first_name,
      p_last_name: last_name,
      p_dob: dob || null,
      p_guardian_phone: guardian_phone || null,
      p_school: school || null,
      p_grade: grade || null
    });

    if (error) {
      console.error('Registration error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ student: data }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
