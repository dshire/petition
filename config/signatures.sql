DROP TABLE IF EXISTS signatures;

CREATE TABLE signatures(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    signature TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
