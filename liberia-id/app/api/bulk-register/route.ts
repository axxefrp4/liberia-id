import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { students } = body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: 'Students array is required' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const student of students) {
      const { first_name, last_name, dob, guardian_phone, school, grade } = student;

      if (!first_name || !last_name) {
        errors.push({ 
          student, 
          error: 'First name and last name are required' 
        });
        continue;
      }

      try {
        const { data, error } = await supabase.rpc('register_student', {
          p_first_name: first_name,
          p_last_name: last_name,
          p_dob: dob || null,
          p_guardian_phone: guardian_phone || null,
          p_school: school || null,
          p_grade: grade || null
        });

        if (error) {
          errors.push({ student, error: error.message });
        } else {
          results.push(data);
        }
      } catch (err: any) {
        errors.push({ student, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      total: students.length,
      registered: results.length,
      errors: errors.length,
      students: results,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Bulk registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
