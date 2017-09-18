CREATE TABLE application (
  property varchar not null,
  value text not null,
  created_at timestamp,
  updated_at timestamp,
  deleted_at timestamp,
  PRIMARY KEY(property)
)
WITH (
  OIDS=FALSE
) ;

CREATE TABLE installations (
  version varchar not null,
  created_at timestamp,
  updated_at timestamp,
  deleted_at timestamp,
  PRIMARY KEY(version)
)
WITH (
  OIDS=FALSE
) ;
