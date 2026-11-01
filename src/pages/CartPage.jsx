import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatPrice } from '../utils/helpers'

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '')

export default function CartPage({ items, total, onQuantity, onRemove }) {
  const handleCheckout = () => {
    const orderLines = items.map((item) =>
      `- ${item.name} x${item.quantity} = ${formatPrice(item.price * item.quantity)}`,
    )
    const message = [
      '[SIMULASI DEMO - BUKAN PESANAN NYATA]',
      'Halo, saya ingin mencoba alur checkout demo:',
      ...orderLines,
      `Total simulasi: ${formatPrice(total)}`,
    ].join('\n')
    const destination = whatsappNumber ? `https://wa.me/${whatsappNumber}` : 'https://wa.me/'
    window.location.assign(`${destination}?text=${encodeURIComponent(message)}`)
  }

  return (
    <div className="cart-page">
      <section className="masthead">
        <h1 className="display">Keranjang Demo</h1>
        <p className="lede">Keranjang dan checkout ini hanya simulasi akademik.</p>
      </section>

      {items.length === 0 ? (
        <div className="state-box">
          <ShoppingBag size={32} />
          <h2>Keranjang masih kosong</h2>
          <p>Tambahkan produk dari katalog demo untuk mencoba alur keranjang.</p>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {items.map((item) => (
              <li className="cart-item" key={item.id}>
                <img src={item.image_url} alt="" loading="lazy" />
                <div className="cart-item__details">
                  <h2>{item.name}</h2>
                  <p>{formatPrice(item.price)} per item</p>
                </div>
                <div className="cart-item__quantity" aria-label={`Jumlah ${item.name}`}>
                  <button type="button" className="icon-btn" onClick={() => onQuantity(item.id, item.quantity - 1)} aria-label="Kurangi jumlah">
                    <Minus size={14} />
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" className="icon-btn" onClick={() => onQuantity(item.id, item.quantity + 1)} aria-label="Tambah jumlah">
                    <Plus size={14} />
                  </button>
                </div>
                <strong className="cart-item__subtotal">{formatPrice(item.price * item.quantity)}</strong>
                <button type="button" className="btn btn--danger-ghost" onClick={() => onRemove(item.id)} aria-label={`Hapus ${item.name}`}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <span>Total simulasi</span>
            <strong>{formatPrice(total)}</strong>
            <button type="button" className="btn btn--primary" onClick={handleCheckout}>
              Checkout simulasi via WhatsApp
            </button>
            <p>WhatsApp akan dibuka dengan pesan yang menandai transaksi sebagai simulasi.</p>
          </div>
        </>
      )}
    </div>
  )
}
