import mysql.connector
import os
from dotenv import load_dotenv

try:
    connection = mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    cursor = connection.cursor(dictionary=True)
    cursor.execute("SELECT category_id, category_name FROM category ORDER BY category_id")
    categories = cursor.fetchall()
    
    print("Available Categories:")
    for category in categories:
        print(f"  ID: {category['category_id']}, Name: {category['category_name']}")

except mysql.connector.Error as err:
    print(f"Error: {err}")

finally:
    if 'connection' in locals() and connection.is_connected():
        cursor.close()
        connection.close()
