/**
 * READ-ONLY Supabase Database Audit Script
 * This script queries the database to verify current state
 * NO DATA IS MODIFIED
 */

import { supabase } from '../lib/supabaseClient'

async function auditDatabase() {
  console.log('\n=== SUPABASE DATABASE AUDIT ===\n')

  try {
    // 1. Query all frames
    console.log('1. QUERYING FRAMES TABLE...')
    const { data: framesData, error: framesError } = await supabase
      .from('frames')
      .select('*')

    if (framesError) {
      console.error('ERROR querying frames:', framesError)
      return
    }

    console.log(`Found ${framesData?.length || 0} frames:`)
    console.log(JSON.stringify(framesData, null, 2))

    // 2. Query all frame_slots for each frame
    console.log('\n2. QUERYING FRAME_SLOTS TABLE...')
    const { data: slotsData, error: slotsError } = await supabase
      .from('frame_slots')
      .select('*')
      .order('frame_id', { ascending: true })
      .order('slot_order', { ascending: true })

    if (slotsError) {
      console.error('ERROR querying frame_slots:', slotsError)
      return
    }

    console.log(`Found ${slotsData?.length || 0} total frame slots:`)
    
    // Group by frame_id for readability
    const slotsByFrame = (slotsData || []).reduce((acc: Record<string, any[]>, slot) => {
      if (!acc[slot.frame_id]) acc[slot.frame_id] = []
      acc[slot.frame_id].push(slot)
      return acc
    }, {})

    Object.entries(slotsByFrame).forEach(([frameId, slots]) => {
      console.log(`\n  Frame ${frameId}: ${slots.length} slots`)
      slots.forEach((slot: any) => {
        console.log(`    Slot ${slot.slot_order}: x=${slot.x}, y=${slot.y}, w=${slot.width}, h=${slot.height}, rotation=${slot.rotation}`)
      })
    })

    // 3. Query profiles (for creatorName resolution)
    console.log('\n3. QUERYING PROFILES TABLE...')
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('ERROR querying profiles:', profilesError)
      return
    }

    console.log(`Found ${profilesData?.length || 0} profiles:`)
    profilesData?.forEach((profile: any) => {
      console.log(`  ${profile.id}: ${profile.display_name}`)
    })

    // 4. Check Storage buckets
    console.log('\n4. CHECKING STORAGE BUCKETS...')
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('ERROR listing buckets:', bucketsError)
    } else {
      console.log(`Found ${buckets?.length || 0} buckets:`)
      buckets?.forEach((bucket: any) => {
        console.log(`  - ${bucket.name}`)
      })

      // Try to list files in 'frames' bucket if it exists
      const framesBucket = buckets?.find((b: any) => b.name === 'frames')
      if (framesBucket) {
        console.log('\n  Contents of "frames" bucket:')
        const { data: files, error: filesError } = await supabase.storage
          .from('frames')
          .list('', { limit: 100 })

        if (filesError) {
          console.error('    ERROR listing files:', filesError)
        } else {
          if (!files || files.length === 0) {
            console.log('    (empty)')
          } else {
            files.forEach((file: any) => {
              console.log(`    - ${file.name}`)
            })
          }
        }
      }
    }

    // 5. Verify RLS permissions (test SELECT as anon)
    console.log('\n5. TESTING RLS POLICIES...')
    console.log('  Testing: SELECT public frames as anon user...')
    
    // Create an anon client to test RLS
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    if (supabaseUrl && supabaseAnonKey) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey)
      const { data: anonFrames, error: anonError } = await anonClient
        .from('frames')
        .select('id, name, type')

      if (anonError) {
        console.error('    ERROR:', anonError)
      } else {
        console.log(`    ✓ Anon users can see ${anonFrames?.length || 0} frames`)
      }
    }

    console.log('\n=== AUDIT COMPLETE ===\n')
  } catch (error) {
    console.error('UNEXPECTED ERROR:', error)
  }
}

// Export for use in other modules
export { auditDatabase }
