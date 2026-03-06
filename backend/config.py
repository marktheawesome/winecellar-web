from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    pg_host: str = "localhost"
    pg_port: int = 5432
    pg_database: str = "winecellar"
    pg_user: str = "postgres"
    pg_password: str = ""

    # Pool settings
    pg_pool_min: int = 2
    pg_pool_max: int = 10

    # App settings
    cors_origins: str = "*"

    @property
    def dsn(self) -> str:
        return (
            f"postgresql://{self.pg_user}:{self.pg_password}"
            f"@{self.pg_host}:{self.pg_port}/{self.pg_database}"
        )

    class Config:
        env_prefix = ""
        env_file = ".env"


settings = Settings()
