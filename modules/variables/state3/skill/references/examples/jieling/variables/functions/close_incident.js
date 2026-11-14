([incidents, index]) => incidents.map((item, position) => position === index ? { ...item, open: false } : item)
