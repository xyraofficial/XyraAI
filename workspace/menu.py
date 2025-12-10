def show_menu():
    print("Simple Menu")
    print("1. Tambah Data")
    print("2. Lihat Data")
    print("3. Keluar")

def tambah_data():
    nama = input("Masukkan Nama: ")
    data.append(nama)
    print("Data berhasil ditambahkan!")

def lihat_data():
    if len(data) == 0:
        print("Data kosong!")
    else:
        for i, nama in enumerate(data, start=1):
            print(f"{i}. {nama}")

data = []
while True:
    show_menu()
    pilih = input("Pilih menu: ")
    if pilih == "1":
        tambah_data()
    elif pilih == "2":
        lihat_data()
    elif pilih == "3":
        print("Terima kasih!")
        break
    else:
        print("Menu tidak tersedia!")