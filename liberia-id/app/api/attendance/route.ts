import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { national_id, status, school_name, scanned_by } = body;

    // Validation
    if (!national_id) {
      return NextResponse.json(
        { error: 'National ID is required' },
        { status: 400 }
      );
    }

    if (!status || !['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status (present/absent/late) is required' },
        { status: 400 }
      );
    }

    // 1. Find the student by their national ID
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, current_school')
      .eq('national_id', national_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found with this ID' },
        { status: 404 }
      );
    }

    // 2. Record the attendance
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        student_id: student.id,
        school_name: school_name || student.current_school || 'Unknown',
        status: status,
        scanned_by: scanned_by || 'Teacher'
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('Attendance insert error:', attendanceError);
      return NextResponse.json(
        { error: 'Failed to record attendance' },
        { status: 500 }
      );
    }

    // 3. Return success with student name for UI feedback
    return NextResponse.json({
      success: true,
      student: {
        name: `${student.first_name} ${student.last_name}`,
        id: student.id
      },
      attendance: attendance
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
