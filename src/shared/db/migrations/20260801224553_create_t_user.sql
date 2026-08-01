CREATE TABLE "t_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"mail_address" varchar(255) NOT NULL,
	"hashed_password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "t_user_mail_address_unique" UNIQUE("mail_address")
);
