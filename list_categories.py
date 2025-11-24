import mysql.connector

try:
    connection = mysql.connector.connect(
        host='MirkoLouis',
        port=3306,
        user='MirkoLouis',
        password='One5zero03',
        database='canvasiligan_db'
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
