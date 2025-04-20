from beanie import Document
from pydantic import BaseModel

class User(Document):
    username: str
    email: str # user pydantic email for final project
    password: str # hashed and salted
    role: str # admin | user

    class Settings:
        name = "users"



class UserRequest(BaseModel): #for user signup, similar to create a todo
    """
    model for user signup
    """
    username: str
    email:str
    password: str # plaintext from user request