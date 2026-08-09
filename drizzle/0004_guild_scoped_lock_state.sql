-- Channel IDs are globally unique in Discord, but lock state is guild-owned.
-- Make that ownership explicit in the database constraint as well as queries.
ALTER TABLE "moderation_lock_states" DROP CONSTRAINT "moderation_lock_states_pkey";
ALTER TABLE "moderation_lock_states"
  ADD CONSTRAINT "moderation_lock_states_guild_channel_pk" PRIMARY KEY ("guild_id", "channel_id");
