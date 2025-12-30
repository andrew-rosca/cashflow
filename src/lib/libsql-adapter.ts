/**
 * Custom NextAuth adapter for Turso/libSQL
 * 
 * This adapter replaces PrismaAdapter because Prisma's SQLite provider
 * doesn't support libsql:// URLs. We use @libsql/client directly instead.
 */

import { createClient, Client } from '@libsql/client'
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters'

let libsqlClient: Client | null = null

function getLibSQLClient(): Client {
  if (!libsqlClient) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set')
    }

    // Extract auth token from DATABASE_URL if it contains ?authToken=
    let url = databaseUrl
    let authToken: string | undefined = undefined

    if (databaseUrl.includes('?authToken=')) {
      const [dbUrl, token] = databaseUrl.split('?authToken=')
      url = dbUrl
      authToken = token
    } else {
      // Try to get token from separate env var
      authToken = process.env.TURSO_AUTH_TOKEN
    }

    if (!authToken) {
      throw new Error('TURSO_AUTH_TOKEN or authToken in DATABASE_URL is required')
    }

    libsqlClient = createClient({
      url,
      authToken,
    })
  }
  return libsqlClient
}

export function LibSQLAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const client = getLibSQLClient()
      const id = crypto.randomUUID()
      const now = new Date()

      await client.execute({
        sql: `
          INSERT INTO "User" (id, email, emailVerified, name, image, "createdAt", "updatedAt")
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          id,
          user.email,
          user.emailVerified?.toISOString() || null,
          user.name || null,
          user.image || null,
          now.toISOString(),
          now.toISOString(),
        ],
      })

      return {
        id,
        ...user,
      }
    },

    async getUser(id: string) {
      const client = getLibSQLClient()
      const result = await client.execute({
        sql: 'SELECT * FROM "User" WHERE id = ?',
        args: [id],
      })

      if (result.rows.length === 0) return null

      const row = result.rows[0]
      return {
        id: row.id as string,
        email: row.email as string,
        emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
        name: (row.name as string) || null,
        image: (row.image as string) || null,
      }
    },

    async getUserByEmail(email: string) {
      const client = getLibSQLClient()
      const result = await client.execute({
        sql: 'SELECT * FROM "User" WHERE email = ?',
        args: [email],
      })

      if (result.rows.length === 0) return null

      const row = result.rows[0]
      return {
        id: row.id as string,
        email: row.email as string,
        emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
        name: (row.name as string) || null,
        image: (row.image as string) || null,
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const client = getLibSQLClient()
      const result = await client.execute({
        sql: `
          SELECT u.* FROM "User" u
          INNER JOIN "Account" a ON u.id = a."userId"
          WHERE a.provider = ? AND a."providerAccountId" = ?
        `,
        args: [provider, providerAccountId],
      })

      if (result.rows.length === 0) return null

      const row = result.rows[0]
      return {
        id: row.id as string,
        email: row.email as string,
        emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
        name: (row.name as string) || null,
        image: (row.image as string) || null,
      }
    },

    async updateUser(user: Partial<AdapterUser> & { id: string }) {
      const client = getLibSQLClient()
      const now = new Date()

      const updates: string[] = []
      const args: any[] = []

      if (user.email !== undefined) {
        updates.push('email = ?')
        args.push(user.email)
      }
      if (user.emailVerified !== undefined) {
        updates.push('"emailVerified" = ?')
        args.push(user.emailVerified?.toISOString() || null)
      }
      if (user.name !== undefined) {
        updates.push('name = ?')
        args.push(user.name || null)
      }
      if (user.image !== undefined) {
        updates.push('image = ?')
        args.push(user.image || null)
      }

      updates.push('"updatedAt" = ?')
      args.push(now.toISOString())
      args.push(user.id)

      await client.execute({
        sql: `UPDATE "User" SET ${updates.join(', ')} WHERE id = ?`,
        args,
      })

      const updated = await this.getUser(user.id)
      if (!updated) throw new Error('User not found after update')
      return updated
    },

    async linkAccount(account: AdapterAccount) {
      const client = getLibSQLClient()
      const id = crypto.randomUUID()

      await client.execute({
        sql: `
          INSERT INTO "Account" (
            id, "userId", type, provider, "providerAccountId",
            refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          id,
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token || null,
          account.access_token || null,
          account.expires_at || null,
          account.token_type || null,
          account.scope || null,
          account.id_token || null,
          account.session_state || null,
        ],
      })

      return account
    },

    async unlinkAccount({ providerAccountId, provider }) {
      const client = getLibSQLClient()
      await client.execute({
        sql: 'DELETE FROM "Account" WHERE provider = ? AND "providerAccountId" = ?',
        args: [provider, providerAccountId],
      })
    },

    async createSession({ sessionToken, userId, expires }) {
      const client = getLibSQLClient()
      const id = crypto.randomUUID()

      await client.execute({
        sql: 'INSERT INTO "Session" (id, "sessionToken", "userId", expires) VALUES (?, ?, ?, ?)',
        args: [id, sessionToken, userId, expires.toISOString()],
      })

      return {
        sessionToken,
        userId,
        expires,
      }
    },

    async getSessionAndUser(sessionToken: string) {
      const client = getLibSQLClient()
      const result = await client.execute({
        sql: `
          SELECT s.*, u.* FROM "Session" s
          INNER JOIN "User" u ON s."userId" = u.id
          WHERE s."sessionToken" = ?
        `,
        args: [sessionToken],
      })

      if (result.rows.length === 0) return null

      const row = result.rows[0]
      const expires = new Date(row.expires as string)

      if (expires < new Date()) {
        await this.deleteSession(sessionToken)
        return null
      }

      return {
        session: {
          sessionToken: row.sessionToken as string,
          userId: row.userId as string,
          expires,
        },
        user: {
          id: row.id as string,
          email: row.email as string,
          emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
          name: (row.name as string) || null,
          image: (row.image as string) || null,
        },
      }
    },

    async updateSession({ sessionToken, ...data }) {
      const client = getLibSQLClient()
      const updates: string[] = []
      const args: any[] = []

      if (data.expires !== undefined) {
        updates.push('expires = ?')
        args.push(data.expires.toISOString())
      }
      if (data.userId !== undefined) {
        updates.push('"userId" = ?')
        args.push(data.userId)
      }

      if (updates.length === 0) {
        const result = await client.execute({
          sql: 'SELECT * FROM "Session" WHERE "sessionToken" = ?',
          args: [sessionToken],
        })
        if (result.rows.length === 0) return null
        const row = result.rows[0]
        return {
          sessionToken: row.sessionToken as string,
          userId: row.userId as string,
          expires: new Date(row.expires as string),
        }
      }

      args.push(sessionToken)
      await client.execute({
        sql: `UPDATE "Session" SET ${updates.join(', ')} WHERE "sessionToken" = ?`,
        args,
      })

      const result = await client.execute({
        sql: 'SELECT * FROM "Session" WHERE "sessionToken" = ?',
        args: [sessionToken],
      })
      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        sessionToken: row.sessionToken as string,
        userId: row.userId as string,
        expires: new Date(row.expires as string),
      }
    },

    async deleteSession(sessionToken: string) {
      const client = getLibSQLClient()
      await client.execute({
        sql: 'DELETE FROM "Session" WHERE "sessionToken" = ?',
        args: [sessionToken],
      })
    },

    async createVerificationToken({ identifier, token, expires }) {
      const client = getLibSQLClient()
      await client.execute({
        sql: 'INSERT INTO "VerificationToken" (identifier, token, expires) VALUES (?, ?, ?)',
        args: [identifier, token, expires.toISOString()],
      })

      return { identifier, token, expires }
    },

    async useVerificationToken({ identifier, token }) {
      const client = getLibSQLClient()
      const result = await client.execute({
        sql: 'SELECT * FROM "VerificationToken" WHERE identifier = ? AND token = ?',
        args: [identifier, token],
      })

      if (result.rows.length === 0) return null

      const row = result.rows[0]
      await client.execute({
        sql: 'DELETE FROM "VerificationToken" WHERE identifier = ? AND token = ?',
        args: [identifier, token],
      })

      return {
        identifier: row.identifier as string,
        token: row.token as string,
        expires: new Date(row.expires as string),
      }
    },
  }
}

