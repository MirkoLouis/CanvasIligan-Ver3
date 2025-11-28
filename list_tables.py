import mysql.connector
import os
from dotenv import load_dotenv

# This script connects to the database and lists the tables.
def list_tables():
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME')
        )
        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print("Tables in the database:")
        for table in tables:
            print(table[0])
    except mysql.connector.Error as err:
        print(f"Error: {err}")
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    list_tables()
