from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# pydantic-settings below only populates the fields this class declares.
# Cognee reads its own config (COGNEE_API_KEY, COGNEE_BASE_URL, etc.) straight
# from os.environ, so .env has to actually be loaded into the process
# environment too, not just parsed into this Settings object.
load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", populate_by_name=True
    )

    # Groq
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    groq_fast_model: str = Field(
        default="llama-3.1-8b-instant", alias="GROQ_FAST_MODEL"
    )

    # Cognee
    use_cognee: bool = Field(default=True, alias="USE_COGNEE")
    cognee_dataset: str = Field(default="continuum", alias="COGNEE_DATASET")
    cognify_every: int = Field(default=4, alias="COGNIFY_EVERY")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key)


settings = Settings()
