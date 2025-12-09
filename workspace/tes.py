import time
import os

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def animate():
    frames = [
        '(^_^)',
        '(^_~)',
        '(^_^)',
        '(~_^)'
    ]
    
    try:
        while True:
            for frame in frames:
                clear_screen()
                print('\n' * 3)
                print(f'{" " * 10}{frame}')
                time.sleep(0.5)
    except KeyboardInterrupt:
        print('\nAnimasi selesai!')

if __name__ == '__main__':
    print('Tekan Ctrl+C untuk menghentikan animasi')
    animate()