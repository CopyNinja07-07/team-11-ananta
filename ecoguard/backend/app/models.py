"""Tables. These follow the ER model in our Round 1 deck:
Buildings, Zones, Devices, Occupancy Records, Resource Readings, AI Alerts,
Control Actions, Users, Savings & Carbon. Resource readings are split into
energy (one row per room per 15 min) and water (one row per building per 15 min).
"""
from sqlalchemy import JSON, BigInteger, Boolean, Column, Float, ForeignKey, Index, Integer, String, Text

from .db import Base


class Building(Base):
    __tablename__ = "buildings"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    city = Column(String)
    floors = Column(Integer)


class Zone(Base):
    __tablename__ = "zones"
    id = Column(String, primary_key=True)
    building_id = Column(String, ForeignKey("buildings.id"))
    name = Column(String, nullable=False)
    floor = Column(Integer)
    kind = Column(String)             # class | lab | office
    capacity = Column(Integer)
    equipment = Column(JSON)          # lights, fans, ACs, PCs ... from the asset register


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True)          # e.g. esp32-CR-101
    zone_id = Column(String, ForeignKey("zones.id"), nullable=True)
    kind = Column(String)              # energy_node | water_node | camera | relay
    status = Column(String, default="online")
    last_seen = Column(BigInteger)


class OccupancyRecord(Base):
    __tablename__ = "occupancy_records"
    id = Column(Integer, primary_key=True)
    zone_id = Column(String, ForeignKey("zones.id"), index=True)
    ts = Column(BigInteger, index=True)
    people = Column(Integer)
    source = Column(String, default="cv")          # cv | pir | sim


class EnergyReading(Base):
    __tablename__ = "energy_readings"
    id = Column(Integer, primary_key=True)
    zone_id = Column(String, ForeignKey("zones.id"))
    ts = Column(BigInteger)
    kwh = Column(Float)
    kw = Column(Float)
    expected_kw = Column(Float)
    v_board = Column(Float)        # voltage at the distribution board
    v_room = Column(Float)         # voltage at the room's sub-board
    amps = Column(Float)
    leak_ma = Column(Float)        # phase minus neutral current (earth leakage)
    __table_args__ = (Index("ix_energy_zone_ts", "zone_id", "ts"),)


class WaterReading(Base):
    __tablename__ = "water_readings"
    id = Column(Integer, primary_key=True)
    ts = Column(BigInteger, index=True)
    temp_c = Column(Float)
    grid_on = Column(Boolean)
    floor0_l = Column(Float)
    floor1_l = Column(Float)
    floor2_l = Column(Float)
    pump_on = Column(Boolean)
    pump_l = Column(Float)
    pump_kwh = Column(Float)
    tank_pct = Column(Float)
    sump_pct = Column(Float)
    supply_on = Column(Boolean)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    rule = Column(String, index=True)
    target = Column(String)
    kind = Column(String)              # energy | water | hidden
    title = Column(String)
    status = Column(String, default="open")       # open | actioned | resolved
    feedback = Column(String, nullable=True)       # confirmed | dismissed (builds a labelled dataset)
    start = Column(BigInteger)
    last = Column(BigInteger)
    end = Column(BigInteger, nullable=True)
    kwh = Column(Float, default=0)
    litres = Column(Float, default=0)
    rupees = Column(Float, default=0)
    co2 = Column(Float, default=0)
    info = Column(JSON)
    advice_en = Column(Text)
    advice_hi = Column(Text)


class ControlAction(Base):
    __tablename__ = "control_actions"
    id = Column(Integer, primary_key=True)
    ts = Column(BigInteger)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True)
    target = Column(String)
    command = Column(String)           # switch_off | pump_off | close_valve | work_order | sim_*
    mode = Column(String)              # auto | manual | scheduled
    status = Column(String, default="queued")      # queued | sent | done
    params = Column(JSON)
    avoided_kwh = Column(Float, default=0)
    avoided_l = Column(Float, default=0)
    issued_by = Column(String)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    role = Column(String)              # admin | facility_manager | maintenance | occupant
    phone = Column(String, nullable=True)


class SavingsDaily(Base):
    __tablename__ = "savings_daily"
    date = Column(String, primary_key=True)        # YYYY-MM-DD (IST)
    kwh_used = Column(Float, default=0)
    kwh_wasted = Column(Float, default=0)
    kwh_avoided = Column(Float, default=0)
    litres_used = Column(Float, default=0)
    litres_wasted = Column(Float, default=0)
    litres_avoided = Column(Float, default=0)
    rupees_saved = Column(Float, default=0)
    co2_avoided = Column(Float, default=0)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(JSON)
