import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const nextEmail = normalizedEmail || existing[0].email;
      const nextName = name || existing[0].name;
      if (nextEmail !== existing[0].email || nextName !== existing[0].name) {
        const updated = await db
          .update(users)
          .set({ email: nextEmail, name: nextName })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0] || existing[0];
      }
      return existing[0];
    }

    const inserted = await db.insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Kon gebruiker niet synchroniseren met database.', { cause: error });
  }
}
