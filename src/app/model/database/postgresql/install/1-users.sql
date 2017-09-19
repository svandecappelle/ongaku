CREATE TABLE users (
	id serial NOT NULL,
	username varchar NOT NULL,
	password varchar NOT NULL,
	created_at timestamp,
	updated_at timestamp,
	deleted_at timestamp,
	CONSTRAINT users_pk PRIMARY KEY (id)
)
WITH (
	OIDS=FALSE
) ;
