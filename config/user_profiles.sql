DROP TABLE IF EXISTS user_profiles;

CREATE TABLE user_profiles(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    city TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
