import mysql.connector

# This script connects to the database and lists the tables.
def list_tables():
    try:
        connection = mysql.connector.connect(
            host='MirkoLouis',
            port=3306,
            user='MirkoLouis',
            password='One5zero03',
            database='canvasiligan_db'
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
