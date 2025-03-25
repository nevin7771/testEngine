import db from '@/lib/db';

// src/app/api/chats/route.ts
// You likely have a query like this causing errors:
export const GET = async (req: Request) => {
  try {
    let chats = await db.query.chats.findMany();
    // The issue is likely with how chats are returned or processed
    chats = chats.reverse();
    
    // Before returning, ensure we fix any references to focusModes
    // Map the response to ensure compatibility:
    const fixedChats = chats.map(chat => {
      // If your code expects focusModes but your DB has focusMode
      try {
        // Try to parse the JSON string if it exists
        const focusModes = chat.focusMode ? JSON.parse(chat.focusMode) : ['generalAgent'];
        return {
          ...chat,
          // Add focusModes property for frontend compatibility 
          focusModes: Array.isArray(focusModes) ? focusModes : [chat.focusMode]
        };
      } catch (e) {
        // If parsing fails, assume it's an old format
        return {
          ...chat,
          focusModes: [chat.focusMode]
        };
      }
    });
    
    return Response.json({ chats: fixedChats }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
